#!/bin/bash

# Required for RabbitMQ
export MX_AMQP_USER=costin_carabas_tmp_user
export MX_AMQP_PASS=decde2e3de377ba08617300146b76dce

# Optional (defaults already set to your devnet)
# export MX_AMQP_HOST=devnet-external-k8s-proxy.multiversx.com
# export MX_AMQP_PORT=30006
# export MX_AMQP_VHOST=devnet2
# export MX_AMQP_EXCHANGE=all_events
# export MX_AMQP_QUEUE=costin_queue_temporary

# Strongly recommended: filter to YOUR contract (otherwise see note below)
export MX_TOURNAMENT_CONTRACT=erd1qqqqqqqqqqqqqpgq9zhclje8g8n6xlsaj0ds6xj87lt4rgtzd8sspxwzu7
