const express = require("express");
const PongPlugin = require("./pong_plugin");
const cors = require("cors"); // Import cors module

const pluginUrn = "urn:james.pog:chatshapegpt:0";
const crispAPIIdentifier = "f39d5b9b-6d93-4e14-bcc0-8f97a785e0e1";
const crispAPIKey = "0f3fda817a177f0884d32f57d3d62208418c7318bf7fe86e27601e137b041f5f";

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

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.use("/config/sub", async (req, res) => {
  const websiteId = req.body.website_id;
  const key = req.body.name;
  const token = req.body.token;

  try {
    // Pass apiKey to updatePluginForWebsite
    await plugin.subscribeWebsiteToPlugin(websiteId, key, token);
    res.status(200).send('Update successful');
  } catch (error) {
    console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
    res.status(500).send('Update failed');
  }
});

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
