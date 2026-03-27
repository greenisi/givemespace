module.exports = {
  get(context) {
    return {
      ok: true,
      name: "agent-one-server",
      browserAppUrl: `http://${context.host}:${context.port}`,
      responsibilities: [
        "serve the browser app during development",
        "proxy outbound fetch calls",
        "manage sqlite persistence"
      ]
    };
  }
};
