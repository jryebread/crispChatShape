
const Crisp = require("crisp-api");
const fetch = require('node-fetch');

class PongPlugin {
  constructor(pluginUrn, crispAPIIdentifier, crispAPIKey) {
    this.crispClient = new Crisp();
    this.websites = new Map();
    this.pluginId = "73e319d5-81bf-49bc-adfc-0e7027422048"

    // Authenticate to API with your plugin token (identifier, key)
// eg. CrispClient.authenticate("7c3ef21c-1e04-41ce-8c06-5605c346f73e", "cc29e1a5086e428fcc6a697d5837a66d82808e65c5cce006fbf2191ceea80a0a");
    this.crispClient.authenticate("f39d5b9b-6d93-4e14-bcc0-8f97a785e0e1", "0f3fda817a177f0884d32f57d3d62208418c7318bf7fe86e27601e137b041f5f");
    //from user app.crisp
    // this.crispClient.authenticate("67b4a55c-07fc-4f88-96a7-11aaa9601c39", "edf0b37bdba88236ca06662fe312d7ee76d79c436690c4db2bfe2eac98e5b80c");
    this.crispClient.setTier("plugin")
    this._pluginUrn = pluginUrn;
    this._apiIdentifier = crispAPIIdentifier;
    this._apiKey = crispAPIKey;

    this._initPlugin();
  }
  
  async getSubSettings(websiteId) {
    try {
      const response = await this.crispClient.plugin.getSubscriptionSettings(websiteId, this.pluginId);
  
      const settings = response.settings;
      console.log(settings);
  
      if (!settings.botId) {
        console.error("BotId is missing in the settings.");
        return;
      }
      return { botId: settings.botId, botName: settings.botName, live: settings.live };
    } catch (error) {
      console.error(`Failed to get subscription settings for website ID: ${websiteId}. Error: ${error.message}`);
    }
  }

  async updatePluginForWebsite(websiteId, token, botName, botId, live) {
  
    console.log("UPDATING VALUE")
  
    if (!live) {
      console.log('unsubbing!') 
      await this.crispClient.plugin.updateSubscriptionSettings(
        websiteId,
        this.pluginId,
        { botId: botId, botName: botName, live: live}
      );
      this.reinitializeClient();
      console.log(
        `Successfully unlived plugin config for website ID: ${websiteId}`
      );
  
      return;
    }

    //subscribe
    try {
      await this.crispClient.plugin.updateSubscriptionSettings(
        websiteId,
        this.pluginId,
        { botId: botId, botName: botName, live: live}
      );
      console.log(
        `Successfully updated plugin config for website ID: ${websiteId}`
      );
      this.reinitializeClient();
  
    } catch (error) {
      console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
      throw error;
    }
  }

  _initPlugin() {
    this.crispClient.authenticateTier(
      "plugin", this._apiIdentifier, this._apiKey
    );
    this._events();
  }

  reinitializeClient() {
    // Reinitialize the Crisp client

    this.crispClient.rebindSocket();
    // this.crispClient = new Crisp();
    // this.crispClient.authenticate("f39d5b9b-6d93-4e14-bcc0-8f97a785e0e1", "0f3fda817a177f0884d32f57d3d62208418c7318bf7fe86e27601e137b041f5f");
    // this.crispClient.setTier("plugin");
    // this.crispClient.authenticateTier("plugin", this._apiIdentifier, this._apiKey);

    // Reset the "on" hooks
    // idk if i need this,  if i add it it calls it too much 
    // this._events();
  }

  _events() {
    const self = this;

    this.crispClient.on("message:received", (event) => {
      console.log("Got \"message:received\" event:", event);
    });

    this.crispClient.on("message:send", async (event) => {
      console.log("HANDLING EVENT MESSAGE")

      const userMessage = event.content;
      // fetch botName and botID for particular website
      const result = await this.getSubSettings(event.website_id)
      console.log(result)
      const botName = result.botName
      const botId = result.botId
      const live = result.live

      console.log("live")
      
      if (!live) {
        return;
      }
      
      const response = await fetch('https://arm.chatshape.com/chat', {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "query": userMessage,
            "name": botName,
            "uuid" : botId,
            "h_uuid" : event.session_id
          }),
        });

      const messageContent = await this.readAllChunks(response);
      self.crispClient.website.sendMessageInConversation(
        event.website_id,
        event.session_id,
        {
          type: "text",
          from: "operator",
          origin: self._pluginUrn,
          content: messageContent,
          user: {
            type: "participant",
            nickname: "AI Assistant",
            avatar: "https://plugin.chatshape.com/logo.png",
          }
        }
      )
        .then(response => {
          console.log(response);
        })
        .catch(error => {
          console.error(error);
        });
    });
  }
  
  async readAllChunks(response) {
    const messageContent = await response.text();
    return messageContent;
  }
}

module.exports = PongPlugin;
