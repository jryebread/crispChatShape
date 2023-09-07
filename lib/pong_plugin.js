
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
      // console.log(response);
      // if (response.error) {
      //   console.error(`Failed to get subscription settings for website ID: ${websiteId}. Reason: ${response.reason}`);
      //   return;
      // }
  
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


  async subscribeWebsiteToPlugin(websiteId, key, token) {
    // from user app.crisp
    userCrispClient = new Crisp();
    userCrispClient.authenticate(key, token);
    userCrispClient.setTier("user")
    try {
      userCrispClient.plugin.subscribeWebsiteToPlugin(websiteId, this.pluginId);
    } catch (error) {
      console.error(`Failed to subscribe website to plugin: ${websiteId}. Error: ${error.message}`);
    }
  }

  async updatePluginForWebsite(websiteId, token, botName, botId, live) {
    if (!this.websites[websiteId]) {
      console.error("Website does not exist! Retry with a valid websiteId.");
      return;
    }
  
    console.log("UPDATING VALUE")

    if (!live) {
      console.log('unsubbing!')
      await this.crispClient.plugin.updateSubscriptionSettings(
        websiteId,
        this.pluginId,
        { botId: botId, botName: botName, live: live }
      );
  
      this.websites[websiteId] = { botName: botName, botId: botId, live: live };
  
      console.log(
        `Successfully unlived plugin config for website ID: ${websiteId}`
      );
      return;
    }
  
    try {
      console.log("Subbed website to plugin!")
      await this.crispClient.plugin.updateSubscriptionSettings(
        websiteId,
        this.pluginId,
        { botId: botId, botName: botName, live: live }
      );
  
      this.websites[websiteId] = { botName: botName, botId: botId, live: live };
  
      console.log(
        `Successfully updated plugin config for website ID: ${websiteId}`
      );
    } catch (error) {
      console.error(`Failed to update plugin config for website ID: ${websiteId}. Error: ${error.message}`);
      throw error;
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

      
    // Notice #2: return configured + non-configured plugins altogether.
    // for each website
    let nbWebsites = 0;
    
    const retrieveWebsites = (page) => {
      this.crispClient.plugin.listAllConnectWebsites(page, false)
        .then(websites => {
          let websitesLength = (websites || []).length;
    
          if (websitesLength === 0 && page === 1) {
            console.error(
              "No connected website retrieved. " +
                "Please add a trusted website in your Marketplace settings."
            );
          } else if (websitesLength > 0) {
            for (const website of websites) {
              const botName = website.settings.botName || "Looking for an answer..";
              const botId = website.settings.botId || "Looking for an answer..";
              const live = website.settings.live || "Looking for an answer..";
              console.log("website: ", website)
              this.websites[website.website_id] = {
                token: website.token,
                botName: botName,
                botId: botId,
                live: live
              }
    
              nbWebsites++;
            }
    
            console.log(`Retrieved ${nbWebsites} connected websites!`);
            console.log("Websites configurations:");
            console.log(this.websites);
    
            this._events();
    
            // If there are websites, call the next page
            if (websitesLength > 0) {
              retrieveWebsites(page + 1);
            }
          }
        })
        .catch(error => {
          console.error(error)
        });
    }
    
    // Start retrieving from the first page
    retrieveWebsites(1);
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
      const live = this.websites[event.website_id].live
      
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
