import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional, Callable

import websockets

logger = logging.getLogger(__name__)


class NotifierSubscriber:
    def __init__(self,
                 ws_url: Optional[str] = None,
                 event_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> None:
        self.ws_url = ws_url or os.getenv("MX_NOTIFIER_WS_URL", "ws://localhost:5000/hub/ws")
        # Types: all_events, revert_events, finalized_events
        self.event_type = os.getenv("MX_NOTIFIER_EVENT_TYPE", "all_events")
        self.contract_address = os.getenv("MX_TOURNAMENT_CONTRACT", "")
        self._stop = asyncio.Event()
        self._event_callback = event_callback or self._default_event_handler

    async def start(self) -> None:
        while not self._stop.is_set():
            try:
                logger.info(f"Connecting to Notifier WS at {self.ws_url}")
                async with websockets.connect(self.ws_url, ping_interval=20, ping_timeout=20) as ws:
                    # Subscribe to events
                    subscribe_msg = json.dumps({
                        "type": self.event_type
                    })
                    await ws.send(subscribe_msg)
                    logger.info(f"Subscribed to notifier events type='{self.event_type}'")

                    async for message in ws:
                        try:
                            payload = json.loads(message)
                        except Exception:
                            logger.debug("Received non-JSON notifier payload")
                            continue
                        await self._handle_payload(payload)

            except Exception as e:
                logger.warning(f"Notifier WS connection error: {e}. Reconnecting in 3s...")
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=3)
                except asyncio.TimeoutError:
                    continue

    async def stop(self) -> None:
        self._stop.set()

    async def _handle_payload(self, payload: Dict[str, Any]) -> None:
        # Expected structure per docs: { "Type": "all_events", "Data": { ... } }
        event_type = payload.get("Type") or payload.get("type")
        data = payload.get("Data") or payload.get("data") or payload
        if not data:
            return

        # Push Block Event contains list of events under key 'events'
        events = data.get("events") or []
        for ev in events:
            identifier = ev.get("identifier")
            address = ev.get("address")
            # Filter by our tournament contract if provided
            if self.contract_address and address != self.contract_address:
                continue
            topics = ev.get("topics") or []
            await self._event_callback_safely({
                "type": event_type,
                "identifier": identifier,
                "address": address,
                "topics": topics,
                "raw": ev,
            })

    async def _event_callback_safely(self, event: Dict[str, Any]) -> None:
        try:
            result = self._event_callback(event)
            if asyncio.iscoroutine(result):
                await result
        except Exception as e:
            logger.error(f"Error in notifier event callback: {e}")

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
            logger.info(f"Notifier event: {identifier} -> {json.dumps(event)}")
        else:
            logger.debug(f"Other notifier event: {identifier}")


subscriber_singleton: Optional[NotifierSubscriber] = None


async def start_notifier_subscriber(event_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> None:
    global subscriber_singleton
    if subscriber_singleton is None:
        subscriber_singleton = NotifierSubscriber(event_callback=event_callback)
    await subscriber_singleton.start()


