module.exports = {
  get(context) {
    const path = String(context.params.path || "");

    return {
      ok: true,
      endpoint: "asset_get",
      path,
      content: `dummy-content-for:${path || "unset"}`,
      note: "Dummy asset_get response. File IO is not implemented yet."
    };
  }
};
