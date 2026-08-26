import argparse
import logging

from relay_ai import __version__
from relay_ai.config import load_settings
from relay_ai.redis_transport import RedisTransport

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse worker lifecycle flags from the command line."""
    parser = argparse.ArgumentParser(description="Relay Python AI worker")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate that the worker entry point can start, then exit",
    )
    parser.add_argument(
        "--check-transport",
        action="store_true",
        help="Connect to Redis, ping it, then exit",
    )
    return parser.parse_args()


def main() -> int:
    """Validate worker startup now and host the Redis loop in later milestones."""
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.check:
        logger.info("Relay AI worker %s entry point is ready", __version__)
        return 0

    if args.check_transport:
        transport = RedisTransport.from_settings(load_settings())
        try:
            if not transport.ping():
                logger.error("Redis transport ping returned false")
                return 1
            logger.info("Relay AI worker Redis transport is ready")
            return 0
        finally:
            transport.close()

    logger.info(
        "Relay AI extraction graph is not wired yet; use --check or --check-transport"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
