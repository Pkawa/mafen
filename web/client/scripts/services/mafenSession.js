'use strict';

var jsSHA256 = require('js-sha256/build/sha256.min.js');
var v = require('voca');

angular.module('app').service('mafenSession', function($rootScope, $timeout, $q) {
  'ngInject';

  var that = this;

  this.reset = function() {
    that.loginDeferred = $q.defer();
    that.loggedIn = false;
    that.characters = [];
    that.items = [];
    that.meters = {};
    that.attrs = {};
    that.chats = [];
    that.msgs = {};
    that.players = [];
    that.buddies = {};
    that.callbacks = {};
  };

  var onmessage = function(message) {
    var msg = JSON.parse(message.data);

    if (msg.action === 'connect') {
      if (msg.success) {
        that.loggedIn = true;
        that.loginDeferred.resolve();
      } else {
        that.loginDeferred.reject();
      }
    } else if (msg.action === 'character') {
      that.characters.push(msg.name);
    } else if (msg.action === 'item') {
      that.items.push(msg);
    } else if (msg.action === 'destroy') {
      that.items = that.items.filter(function(item) {
        return item.id !== msg.id;
      });
      delete that.meters[msg.id];
    } else if (msg.action === 'attr') {
      that.attrs = msg.attrs;
    } else if (msg.action === 'meter') {
      that.meters[msg.id] = msg.meter;
    } else if (msg.action === 'mchat') {
      that.chats.push({
        id: msg.id,
        name: msg.name
      });
    } else if (msg.action === 'msg') {
      (that.msgs[msg.chat] = that.msgs[msg.chat] || []).push({
        from: msg.from,
        text: msg.text
      });
    } else if (msg.action === 'player') {
      that.players.push(msg.id);
    } else if (msg.action === 'buddy') {
      that.buddies[msg.id] = msg.name;
    } else if (msg.action === 'pgob') {
      that.pgob = msg.id;
    } else if (msg.action === 'gobrem') {
      that.players = that.players.filter(function(playerId) {
        return playerId !== msg.id;
      });
      delete that.players[msg.id];
    } else {
      // TODO
    }

    var cb = that.callbacks[msg.action];
    if (cb) {
      cb(msg);
    }

    $rootScope.$apply();
  };

  this.waitForConnection = function(callback, interval) {
    if (that.ws.readyState === 1) { // OPEN
      callback();
    } else {
      $timeout(function() {
        that.waitForConnection(callback, interval);
      }, interval);
    }
  };

  this.connect = function(addr) {
    that.ws = new WebSocket(addr);
    that.ws.onmessage = onmessage;
  };

  this.login = function(username, password) {
    that.send({
      action: 'connect',
      data: {
        username: username,
        password: jsSHA256.sha256(password)
      }
    });
    return that.loginDeferred.promise;
  };

  this.send = function(data) {
    // To avoid "Error: Failed to execute 'send' on 'WebSocket': Still in CONNECTING state"
    that.waitForConnection(function() {
      that.ws.send(JSON.stringify(data));
    }, 1000);
  };

  this.close = function() {
    that.ws.close();
  };

  this.getTotalMW = function() {
    var total = 0;
    for (var i = 0; i < that.items.length; ++i) {
      var item = that.items[i];
      if (item.info.curio && item.study) {
        total += item.info.mw;
      }
    }
    return total;
  };

  this.getProgress = function(id) {
    var progress = '';
    for (var i = 0; i < that.items.length; ++i) {
      var item = that.items[i];
      if (item.id === id) {
        var meter = that.meters[id];
        if (meter !== undefined) {
          var minsLeft = item.info.time * (100 - meter) / 100;
          progress = v.sprintf(
            '%d%% (~%s left)',
            meter,
            $rootScope.minutesToHoursMinutes(minsLeft)
          );
        }
        break;
      }
    }
    return progress;
  };

  this.getPlayerName = function(playerId) {
    if (playerId === that.pgob) {
      return 'You';
    }
    return that.buddies[playerId] || '???';
  };

  this.on = function(msgType, callback) {
    that.callbacks[msgType] = callback;
  };
})
