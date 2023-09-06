const express = require("express");
const PongPlugin = require("./pong_plugin");
const cors = require("cors"); // Import cors module

const pluginUrn = "urn:james.pog:chatshapegpt:0";
const crispAPIIdentifier = "23358097-a665-4e33-bd21-482d1cf6a563";
const crispAPIKey = "4322bd7ad1642dd4e6dbe53b70f661ed7a41a7279d0f7dbb7efb6e5470ed5e04";

const app = express();
app.use(cors()); // Use cors middleware, this will allow all CORS requests

const port = 1234;

const plugin = new PongPlugin(
  pluginUrn,
  crispAPIIdentifier,
  crispAPIKey
);

app.use(express.json());

app.use("/", express.static("public"));

app.use("/config/get", async(req, res) => {
  const websiteId = req.body.website_id;
  try {
    const results = await plugin.getSubSettings(websiteId);
    res.status(200).send(results);
  } catch (error) {
    console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
    res.status(500).send('Update failed');
  }
})

app.use("/config/update", async (req, res) => {
  const websiteId = req.body.website_id;
  const botName = req.body.name;
  const botId = req.body.uuid;
  const token = req.body.token;
  const live = req.body.live;

  try {
    // Pass apiKey to updatePluginForWebsite
    await plugin.updatePluginForWebsite(websiteId, token, botName, botId, live);
    res.status(200).send('Update successful');
  } catch (error) {
    console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
    res.status(500).send('Update failed');
  }
});

app.listen(port, () => {
    console.log(`Plugin now listening on port :${port}`)
});
