module.exports = {
  post(context) {
    const payload =
      context.body && typeof context.body === "object" && !Buffer.isBuffer(context.body)
        ? context.body
        : {};

    return {
      ok: true,
      endpoint: "asset_set",
      path: String(payload.path || context.params.path || ""),
      content: String(payload.content || ""),
      note: "Dummy asset_set response. File IO is not implemented yet."
    };
  }
};
