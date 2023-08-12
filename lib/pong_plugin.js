
const Crisp = require("crisp-api");
const fetch = require('node-fetch');

class PongPlugin {
  constructor(pluginUrn, crispAPIIdentifier, crispAPIKey) {
    this.crispClient = new Crisp();
    this.websites = new Map();

    this._pluginUrn = pluginUrn;
    this._apiIdentifier = crispAPIIdentifier;
    this._apiKey = crispAPIKey;

    this._initPlugin();
  }

  async updateMessageForWebsite(websiteId, token, botName, botId, live) {
    if (!this.websites[websiteId]) {
      console.error("Website does not exist! Retry with a valid websiteId.");
      return;
    }
  
    if (token !== this.websites[websiteId].token) {
      console.error("Tokens do not match! Retry with a valid token.");
      return;
    }
  
    console.log("UPDATING VALUE")

    if (!live) {
      await this.crispClient.plugin.unsubscribePluginFromWebsite(websiteId, this._pluginId)
      return;
    }
  
    try {
      // Subscribe the user 
      await this.crispClient.plugin.subscribeWebsiteToPlugin(websiteId, this._pluginId);
      await this.crispClient.plugin.updateSubscriptionSettings(
        websiteId,
        this._pluginId,
        { botId: botId, botName: botName }
      );
  
      this.websites[websiteId] = { botName: botName, botId: botId };
  
      console.log(
        `Successfully updated plugin config for website ID: ${websiteId}`
      );
    } catch (error) {
      console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
    }
  }

  _initPlugin() {
    this.crispClient.authenticateTier(
      "plugin", this._apiIdentifier, this._apiKey
    );

    // Retrieve plugin ID for later use.
    this.crispClient.plugin.getConnectAccount()
      .then(response => {
        this._pluginId = response.plugin_id;

        console.log(`Successfully retrived plugin ID: ${this._pluginId}`);
      })
      .catch(error => {
        console.error(error);
      });

    // Retrieve all websites connected to this plugin.
    // Notice #1: we only retrieve the first page there, you should implement \
    //   paging to the end, in a real-world situation.
    // Notice #2: return configured + non-configured plugins altogether.
    // for each website
    this.crispClient.plugin.listAllConnectWebsites(1, false)
      .then(websites => {
        let nbWebsites = (websites || []).length;

        if (nbWebsites === 0) {
          console.error(
            "No connected website retrieved. " +
              "Please add a trusted website in your Marketplace settings."
          );
        } else {
          for (const website of websites) {
            const botName = website.settings.botName || "Looking for an answer..";
            const botId = website.settings.botId || "Looking for an answer..";

            this.websites[website.website_id] = {
              token: website.token,
              botName: botName,
              botId: botId,
            }

            nbWebsites++;
          }

          console.log(`Retrieved ${nbWebsites} connected websites!`);
          console.log("Websites configurations:");
          console.log(this.websites);

          this._events();
        }
      })
      .catch(error => {
        console.error(error)
      });
  }

  _events() {
    const self = this;

    this.crispClient.on("message:received", (event) => {
      console.log("Got \"message:received\" event:", event);
    });

    this.crispClient.on("message:send", async (event) => {
      const userMessage = event.content;
      // fetch botName and botID for particular website
      const botName = this.websites[event.website_id].botName;
      const botId = this.websites[event.website_id].botId;
    
      
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
            nickname: "AI",
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
