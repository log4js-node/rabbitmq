const assert = require('assert');

const state = {
  params: {},
  msgs: [],
  msgCallbacks: [],
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
  close: () => new Promise((resolve) => {
    state.msgCallbacks.push(resolve);
  })
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

const connectionPromise = connectionError => new Promise((resolve, reject) => {
  if (connectionError) {
    reject(connectionError);
  }
  resolve(connection());
});

module.exports = (connectionError) => {
  state.params = {};
  state.msgs = [];
  state.msgCallbacks = [];
  state.closed = false;
  const fakeRabbitmq = {
    state,
    connect: function (conn) {
      state.params = conn;
      return connectionPromise(connectionError);
    }
  };
  return fakeRabbitmq;
};
