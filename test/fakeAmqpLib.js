const assert = require('assert');

const state = {
  params: {},
  msgs: [],
  closed: false
};

const channel = () => ({
  assertExchange: (exch, type, opts) => new Promise((resolve) => {
    assert.strictEqual(exch, state.params.exchange);
    assert.strictEqual(type, state.params.mq_type);
    assert.strictEqual(opts.durable, state.params.durable);
    resolve();
  }),
  publish: (exch, key, msg) => {
    state.msgs.push(msg);
  },
  close: () => {
    if (state.doNotResolveMessages) {
      const msgPromise = {
        finish: function () { this.resolve(); }
      };
      const promise = new Promise((resolve) => {
        msgPromise.resolve = resolve;
      });
      state.msgPromises.push(msgPromise);
      return promise;
    }
    return Promise.resolve();
  }
});

const channelPromise = () => new Promise((resolve) => {
  resolve(channel());
});

const connection = () => ({
  createChannel: function () {
    return channelPromise();
  },
  close: function () {
    state.closed = true;
    return new Promise((resolve) => {
      resolve();
    });
  }
});

module.exports = (connectionError, options) => {
  state.params = {};
  state.msgs = [];
  state.msgPromises = [];
  state.doNotResolveMessages = options.doNotResolveMessages;
  state.closed = false;
  const fakeRabbitmq = {
    state,
    connect: function (params) {
      state.params = params;
      return new Promise((resolve, reject) => {
        if (connectionError) {
          reject(connectionError);
          return;
        }
        if (!options.doNotConnect) {
          resolve(connection());
        }
      });
    },
    resolveMessages: function () {
      state.msgPromises.forEach(p => p.finish());
    }
  };
  return fakeRabbitmq;
};
