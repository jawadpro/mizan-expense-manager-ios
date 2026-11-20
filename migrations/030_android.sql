-- Android phones. An Android phone pairs like an iPhone, with a one-time code from a QR code, and gets its own key.
-- That key sends bank alerts (from the Mizan Companion app or an SMS forwarder app) and can read the widget
-- endpoints, like an iPhone's. Android phones are listed apart from iPhones and have their own limit.
ALTER TABLE app.paired_devices DROP CONSTRAINT IF EXISTS paired_devices_kind_check;
ALTER TABLE app.paired_devices ADD CONSTRAINT paired_devices_kind_check CHECK (kind IN ('shortcut', 'widget', 'android'));

ALTER TABLE app.pairing_codes DROP CONSTRAINT IF EXISTS pairing_codes_device_kind_check;
ALTER TABLE app.pairing_codes ADD CONSTRAINT pairing_codes_device_kind_check CHECK (device_kind IN ('shortcut', 'widget', 'android'));
