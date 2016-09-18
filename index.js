var request = require("request");
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-simple-door", "SimpleDoorAccessory", SimpleDoorAccessory);
}

function SimpleDoorAccessory(log, config) {
  this.log = log;
  this.name = config["name"];
  this.url = config["url"];
  this.fields = config["post_fields"];

  this.service = new Service.LockMechanism(this.name);

  this.service
    .getCharacteristic(Characteristic.LockCurrentState)
    .on('get', this.getState.bind(this));

  this.service
    .getCharacteristic(Characteristic.LockTargetState)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));
}

SimpleDoorAccessory.prototype.getState = function(callback) {
  this.log("State requested, door is always locked.");
  callback(null, true);
}

SimpleDoorAccessory.prototype.setState = function(state, callback) {
  var desiredState = (state == Characteristic.LockTargetState.SECURED) ? "lock" : "unlock";
  this.log("Set state to %s", desiredState);

  if (state == Characteristic.LockTargetState.UNSECURED) {
    request.post({
      url: this.url,
      qs: this.fields
    }, function(err, response, body) {
      var uri = response.headers['location'];
      var arr = decodeURIComponent(uri).split('?')[1];
      arr = arr.split('&').reduce(function(acc, el) {
        var comp = el.split('=');
        acc[comp[0]] = comp[1];
        return acc;
      }, {});
      if (arr['IsError'] == 'False') {
        var unlockTime = parseInt(arr['Message'].replace(/[a-ö. ]/gi, ''));
        this.log("Door unlocked for %s seconds.", unlockTime);
        var that = this;
        setTimeout(function() {
            that.service.setCharacteristic(Characteristic.LockCurrentState,
                                           Characteristic.LockCurrentState.SECURED);
            that.log("Door automatically locked.")
        }, unlockTime*1000);

        // we succeeded, so update the "current" state as well
        this.service.setCharacteristic(Characteristic.LockCurrentState,
                                       Characteristic.LockCurrentState.UNSECURED);

        callback(null); // success
      }
      else {
        this.log("Error setting lock state. Response: %s", arr['Message']);
        callback(err || new Error("Error setting lock state."));
      }
    }.bind(this));
  } else {
      this.service.setCharacteristic(Characteristic.LockCurrentState,
                                     Characteristic.LockCurrentState.SECURED);
      callback(null);
  }
}

SimpleDoorAccessory.prototype.getServices = function() {
  return [this.service];
}
