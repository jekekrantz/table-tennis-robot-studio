# Security policy

## Reporting

Please avoid posting live device identifiers, Bluetooth dumps containing personal or
device-specific identifiers, or other private data in public issues. Redact those
fields before sharing diagnostics.

For code review, treat any change to BLE authentication, packet construction, Start/
Stop state handling, or calibration-to-hardware conversion as safety-sensitive because
it can change physical robot behavior.

## Secrets

This static app is not expected to contain account credentials or API keys. The BLE
service/characteristic UUIDs and the protocol authentication salt are protocol
interoperability constants rather than user credentials. Do not add personal access
tokens, browser exports, `.env` files, device-specific captures, or private keys to
the repository.
