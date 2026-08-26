import argparse
import logging

from relay_ai import __version__

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse worker lifecycle flags from the command line."""
    parser = argparse.ArgumentParser(description="Relay Python AI worker")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate that the worker entry point can start, then exit",
    )
    return parser.parse_args()


def main() -> int:
    """Validate worker startup now and host the Redis loop in later milestones."""
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.check:
        logger.info("Relay AI worker %s entry point is ready", __version__)
        return 0

    logger.info(
        "Relay AI worker transport is scheduled for v0.5; use --check for foundation validation"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
