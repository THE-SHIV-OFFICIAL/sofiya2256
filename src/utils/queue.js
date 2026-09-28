const queue = {
  add: async (name, data) => {
    console.log(`[Queue] Added job: ${name}`, data);
    // BullMQ will be implemented later
    return true;
  }
};

module.exports = queue;
