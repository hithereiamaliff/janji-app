// Runs once in Jest's parent process, so every test worker inherits the same time zone and date
// formatting tests pass on any developer machine, not just ones set to UTC.
module.exports = () => {
  process.env.TZ = "UTC";
};
