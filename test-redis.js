const { Queue } = require("bullmq");
const q = new Queue("test", {
  connection: {
    host: "localhost",
    port: 6379,
    family: 0,
  }
});
q.on("error", console.log);
q.client.then(client => {
  client.ping().then(console.log).catch(console.error);
});
setTimeout(() => process.exit(0), 1000);
