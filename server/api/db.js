module.exports = {
  get() {
    return {
      status: 501,
      body: {
        error: "SQLite endpoint not implemented yet",
        hint: "Use this route family for persistence and migrations."
      }
    };
  },
  post() {
    return {
      status: 501,
      body: {
        error: "SQLite endpoint not implemented yet",
        hint: "Use this route family for persistence and migrations."
      }
    };
  }
};
