
const appletv = require('node-appletv');

/**
 * Represents a physical Apple TV device.
 * @param platform The AppleTvPlatform instance.
 * @param config The device configuration.
 * @param credentials The credentials of the device.
 * @param appleTv The Apple TV API.
 */
function AppleTvDevice(platform, config, credentials, appleTv) {
    const device = this;
    const { UUIDGen, Accessory, Characteristic, Service } = platform;

    // Sets the unique identifier, name and platform
    device.name = config.name;
    device.uniqueIdentifier = credentials.uniqueIdentifier;
    device.appleTv = appleTv;
    device.platform = platform;

    // Gets all accessories from the platform that match the Nuki ID
    let unusedDeviceAccessories = platform.accessories.filter(function(a) { return a.context.uniqueIdentifier === device.uniqueIdentifier; });
    let newDeviceAccessories = [];
    let deviceAccessories = [];

    // Gets the switch accessory
    let switchAccessory = null;
    if (config.isOnOffSwitchEnabled || config.isPlayPauseSwitchEnabled) {
        switchAccessory = unusedDeviceAccessories.find(function(a) { return a.context.kind === 'SwitchAccessory'; });
        if (switchAccessory) {
            unusedDeviceAccessories.splice(unusedDeviceAccessories.indexOf(switchAccessory), 1);
        } else {
            platform.log('Adding new accessory with unique ID ' + device.uniqueIdentifier + ' and kind SwitchAccessory.');
            switchAccessory = new Accessory(config.name, UUIDGen.generate(device.uniqueIdentifier + 'SwitchAccessory'));
            switchAccessory.context.uniqueIdentifier = device.uniqueIdentifier;
            switchAccessory.context.kind = 'SwitchAccessory';
            newDeviceAccessories.push(switchAccessory);
        }
        deviceAccessories.push(switchAccessory);

        // Registers the newly created accessories
        platform.api.registerPlatformAccessories(platform.pluginName, platform.platformName, newDeviceAccessories);
    }

    // Removes all unused accessories
    for (let i = 0; i < unusedDeviceAccessories.length; i++) {
        const unusedDeviceAccessory = unusedDeviceAccessories[i];
        platform.log('Removing unused accessory with unique ID ' + device.uniqueIdentifier + ' and kind ' + unusedDeviceAccessory.context.kind + '.');
        platform.accessories.splice(platform.accessories.indexOf(unusedDeviceAccessory), 1);
    }
    platform.api.unregisterPlatformAccessories(platform.pluginName, platform.platformName, unusedDeviceAccessories);

    // Updates the accessory information
    if (config.isOnOffSwitchEnabled || config.isPlayPauseSwitchEnabled) {
        for (let i = 0; i < deviceAccessories.length; i++) {
            const deviceAccessory = deviceAccessories[i];
            let accessoryInformationService = deviceAccessory.getService(Service.AccessoryInformation);
            if (!accessoryInformationService) {
                accessoryInformationService = deviceAccessory.addService(Service.AccessoryInformation);
            }
            accessoryInformationService
                .setCharacteristic(Characteristic.Manufacturer, 'Apple')
                .setCharacteristic(Characteristic.Model, 'Apple TV')
                .setCharacteristic(Characteristic.SerialNumber, device.uniqueIdentifier);
        }

        // Updates the on/off switch service
        let onOffSwitchService = switchAccessory.getServiceByUUIDAndSubType(Service.Switch, 'Power');
        if (config.isOnOffSwitchEnabled) {
            if (!onOffSwitchService) {
                onOffSwitchService = switchAccessory.addService(Service.Switch, 'Power', 'Power');
            }
        } else {
            if (onOffSwitchService) {
                switchAccessory.removeService(onOffSwitchService);
                onOffSwitchService = null;
            }
        }

        // Updates the play/pause switch service
        let playPauseSwitchService = switchAccessory.getServiceByUUIDAndSubType(Service.Switch, 'Play');
        if (config.isPlayPauseSwitchEnabled) {
            if (!playPauseSwitchService) {
                playPauseSwitchService = switchAccessory.addService(Service.Switch, 'Play', 'Play');
            }
        } else {
            if (playPauseSwitchService) {
                switchAccessory.removeService(playPauseSwitchService);
                playPauseSwitchService = null;
            }
        }

        // Subscribes for changes of the on/off switch
        if (onOffSwitchService) {
            onOffSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {

                // Sends the command to the Apple TV
                const usage = platform.getUsage('topmenu');
                if (value) {
                    appleTv.sendKeyPressAndRelease(usage.usePage, usage.usage);
                } else {
                    appleTv.sendKeyPress(usage.usePage, usage.usage, true).then(function() { 
                        setTimeout(function() {
                            appleTv.sendKeyPress(usage.usePage, usage.usage, false).then(function() { 
                                appleTv.sendKeyCommand(appletv.AppleTV.Key.Select);
                            });
                        }, 1000);
                    });
                }

                // Performs the callback
                callback(null);
            });
        }

        // Subscribes for changes of the play/pause switch
        if (playPauseSwitchService) {
            playPauseSwitchService.getCharacteristic(Characteristic.On).on('set', function (value, callback) {

                // Sends the command to the Apple TV
                if (value) {
                    appleTv.sendKeyCommand(appletv.AppleTV.Key.Play);
                } else {
                    appleTv.sendKeyCommand(appletv.AppleTV.Key.Pause);
                }

                // Performs the callback
                callback(null);
            });
        }

        // Subscribes for messages
        // TODO
        //appleTv.on('message', function(message) {
        //    console.log(message);
        //});
    }
}

/**
 * Defines the export of the file.
 */
module.exports = AppleTvDevice;