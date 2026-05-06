# ESP32 Firmware

`include/config.h` contains local MQTT credentials and is intentionally ignored by Git.

For a fresh checkout:

1. Copy `include/config.example.h` to `include/config.h`.
2. Fill the EMQX host, username, and password in `include/config.h`.
3. Build or upload with PlatformIO.

Do not commit `include/config.h`.
