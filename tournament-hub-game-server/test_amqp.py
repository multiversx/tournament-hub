#!/usr/bin/env python3
import os
import pika
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_amqp_connection():
    """Test AMQP connection with current environment variables"""
    
    # Load environment variables
    host = os.getenv("MX_AMQP_HOST", "devnet-external-k8s-proxy.multiversx.com")
    port = int(os.getenv("MX_AMQP_PORT", "30006"))
    vhost = os.getenv("MX_AMQP_VHOST", "devnet2")
    user = os.getenv("MX_AMQP_USER", "costin_carabas_tmp_user")
    password = os.getenv("MX_AMQP_PASS", "decde2e3de377ba08617300146b76dce")
    exchange = os.getenv("MX_AMQP_EXCHANGE", "all_events")
    
    logger.info(f"Testing AMQP connection:")
    logger.info(f"  Host: {host}")
    logger.info(f"  Port: {port}")
    logger.info(f"  VHost: {vhost}")
    logger.info(f"  User: {user}")
    logger.info(f"  Password: {'*' * len(password) if password else 'NOT SET'}")
    logger.info(f"  Exchange: {exchange}")
    
    try:
        # Create credentials
        credentials = pika.PlainCredentials(user, password)
        
        # Create connection parameters
        params = pika.ConnectionParameters(
            host=host,
            port=port,
            virtual_host=vhost,
            credentials=credentials,
            heartbeat=30,
            blocked_connection_timeout=300,
            connection_attempts=3,
            retry_delay=2,
            socket_timeout=10,
        )
        
        logger.info("Attempting to connect to RabbitMQ...")
        connection = pika.BlockingConnection(params)
        logger.info("✅ Successfully connected to RabbitMQ!")
        
        # Test channel creation
        channel = connection.channel()
        logger.info("✅ Successfully created channel!")
        
        # Test exchange declaration (passive=True means we're checking if it exists)
        try:
            channel.exchange_declare(exchange=exchange, exchange_type='fanout', durable=True, passive=True)
            logger.info(f"✅ Exchange '{exchange}' exists and is accessible!")
        except Exception as e:
            logger.error(f"❌ Exchange '{exchange}' error: {e}")
            logger.info("This might be normal if the exchange doesn't exist yet")
        
        # Test queue creation
        try:
            result = channel.queue_declare(queue="test_queue", durable=False, exclusive=False, auto_delete=True)
            queue_name = result.method.queue
            logger.info(f"✅ Successfully created test queue: {queue_name}")
            
            # Test queue binding
            channel.queue_bind(exchange=exchange, queue=queue_name)
            logger.info(f"✅ Successfully bound queue to exchange!")
            
        except Exception as e:
            logger.error(f"❌ Queue operations error: {e}")
        
        # Close connection
        connection.close()
        logger.info("✅ Connection closed successfully!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ AMQP connection failed: {e}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    print("Testing AMQP connection...")
    success = test_amqp_connection()
    if success:
        print("\n🎉 AMQP connection test PASSED!")
    else:
        print("\n💥 AMQP connection test FAILED!")
