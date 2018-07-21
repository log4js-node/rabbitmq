const debug = require('debug')('test');
const appender = require('../lib').configure({}, {
  messagePassThroughLayout: e => e.data[0]
});

debug('sending message');
appender({
  data: ['some log message']
});

debug('shutting down');
appender.shutdown(() => {
  debug('all done');
});
