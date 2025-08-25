import json
import logging
import os
import threading
import time
from typing import Any, Dict, Optional, Callable

import pika

logger = logging.getLogger(__name__)


class RabbitNotifierSubscriber:
    def __init__(self,
                 amqp_url: Optional[str] = None,
                 amqp_host: Optional[str] = None,
                 amqp_port: Optional[int] = None,
                 amqp_vhost: Optional[str] = None,
                 amqp_user: Optional[str] = None,
                 amqp_pass: Optional[str] = None,
                 exchange: str = "all_events",
                 event_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> None:
        # Either amqp_url or host/port/vhost/user/pass
        self.amqp_url = amqp_url or os.getenv("MX_AMQP_URL")
        self.host = amqp_host or os.getenv("MX_AMQP_HOST", "localhost")
        self.port = int(amqp_port or os.getenv("MX_AMQP_PORT", "5672"))
        self.vhost = amqp_vhost or os.getenv("MX_AMQP_VHOST", "/")
        self.user = amqp_user or os.getenv("MX_AMQP_USER", "")
        self.password = amqp_pass or os.getenv("MX_AMQP_PASS", "")
        self.exchange = os.getenv("MX_AMQP_EXCHANGE", exchange)
        self.contract_address = os.getenv("MX_TOURNAMENT_CONTRACT", "")
        self.queue_name = os.getenv("MX_AMQP_QUEUE", "costin_queue_temporary")
        self._stop = False
        self._event_callback = event_callback or self._default_event_handler
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True

    def _run(self) -> None:
        while not self._stop:
            try:
                logger.info("Connecting to RabbitMQ notifier...")
                if self.amqp_url:
                    params = pika.URLParameters(self.amqp_url)
                else:
                    credentials = pika.PlainCredentials(self.user, self.password)
                    params = pika.ConnectionParameters(
                        host=self.host,
                        port=self.port,
                        virtual_host=self.vhost,
                        credentials=credentials,
                        heartbeat=30,
                        blocked_connection_timeout=300,
                    )
                connection = pika.BlockingConnection(params)
                channel = connection.channel()

                channel.exchange_declare(exchange=self.exchange, exchange_type='fanout', durable=True, passive=True)

                result = channel.queue_declare(queue=self.queue_name, durable=False, exclusive=False, auto_delete=True)
                queue_name = result.method.queue

                channel.queue_bind(exchange=self.exchange, queue=queue_name)
                logger.info(f"Bound queue '{queue_name}' to exchange '{self.exchange}'")

                for method_frame, properties, body in channel.consume(queue=queue_name, inactivity_timeout=1):
                    if self._stop:
                        break
                    if not method_frame:
                        continue
                    try:
                        payload = json.loads(body)
                        self._handle_payload(payload)
                    except Exception:
                        pass
                    finally:
                        channel.basic_ack(method_frame.delivery_tag)

                try:
                    channel.close()
                except Exception:
                    pass
                try:
                    connection.close()
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"RabbitMQ notifier connection error: {e}. Reconnecting in 3s...")
                time.sleep(3)

    def _handle_payload(self, payload: Dict[str, Any]) -> None:
        # Accept both WS-like wrapper ({ Type, Data }) and raw push-block ({ hash, events })
        data = payload.get("Data") or payload.get("data") or payload
        if not isinstance(data, dict):
            return
        events = data.get("events") or []
        if not isinstance(events, list):
            return
        if events:
            logger.debug(f"RabbitMQ: received {len(events)} events")
        for ev in events:
            identifier = ev.get("identifier")
            address = ev.get("address")
            if self.contract_address and address != self.contract_address:
                continue
            topics = ev.get("topics") or []
            try:
                event_obj = {
                    "identifier": identifier,
                    "address": address,
                    "topics": topics,
                    "raw": ev,
                }
                self._event_callback(event_obj)
            except Exception as e:
                logger.error(f"Error in RabbitMQ event callback: {e}")

    def _default_event_handler(self, event: Dict[str, Any]) -> None:
        identifier = event.get("identifier")
        if identifier in {
            "tournamentCreated",
            "playerJoined",
            "tournamentStarted",
            "resultsSubmitted",
            "prizesDistributed",
            "tournamentReadyToStart",
            "gameStarted",
        }:
            logger.info(f"RabbitMQ notifier event: {identifier} -> {json.dumps(event)}")
        else:
            logger.debug(f"Other notifier event: {identifier}")


