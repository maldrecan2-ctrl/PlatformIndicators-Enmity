import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const { View, Text } = getByProps("View", "Text") || {};
const Patcher = create('PlatformIndicators');

function findInReactTree(tree: any, filter: (node: any) => boolean): any {
    if (!tree) return null;
    if (filter(tree)) return tree;
    if (Array.isArray(tree)) {
        for (const child of tree) {
            const found = findInReactTree(child, filter);
            if (found) return found;
        }
    } else if (tree.props && tree.props.children) {
        return findInReactTree(tree.props.children, filter);
    }
    return null;
}

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      const getStore = (name: string) => {
          try {
              return (window as any).enmity?.metro?.getByStoreName?.(name) || null;
          } catch (e) {
              return null;
          }
      };

      const PresenceStore = getStore("PresenceStore") || getByProps("getState", "getPresence");
      const SessionStore = getStore("SessionsStore") || getByProps("getSessions");
      const UserStore = getStore("UserStore") || getByProps("getCurrentUser");

      const getPlatformIcons = (userId: string) => {
          if (!PresenceStore || !UserStore) {
              return <Text style={{ color: 'red', fontSize: 14 }}> [?] </Text>;
          }
          
          let statuses;
          try {
              const currentUser = UserStore.getCurrentUser();
              
              if (currentUser && userId === currentUser.id && SessionStore) {
                  const sessions = SessionStore.getSessions() || {};
                  statuses = {};
                  Object.values(sessions).forEach((s: any) => {
                      if (s.clientInfo && s.clientInfo.client !== "unknown") {
                          statuses[s.clientInfo.client] = s.status;
                      }
                  });
              } else {
                  const state = PresenceStore.getState();
                  if (state && state.clientStatuses) {
                      statuses = state.clientStatuses[userId];
                  }
              }
          } catch(e) {
              return <Text style={{ color: 'orange', fontSize: 14 }}> [!] </Text>; 
          }
          
          if (!statuses) return null;
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return null;
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          if (platforms.includes("vr")) icons.push("🥽");
          
          if (icons.length === 0) return null;

          return (
              <View style={{ flexDirection: 'row', marginLeft: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{icons.join(" ")}</Text>
              </View>
          );
      };

      const patchComponent = (module: any, prop: string, callback: any) => {
          if (!module || !module[prop]) return;
          if (typeof module[prop] === "function") {
              Patcher.after(module, prop, callback);
          } else if (typeof module[prop] === "object") {
              if (module[prop].type) Patcher.after(module[prop], "type", callback);
              else if (module[prop].render) Patcher.after(module[prop], "render", callback);
              else Patcher.after(module, prop, callback);
          }
      };

      // Vendetta'daki gibi tam olarak status ikonlarının olduğu Row'u bulalım
      const GuildMemberModule = getByProps("GuildMemberRow");
      if (GuildMemberModule) {
          patchComponent(GuildMemberModule, "GuildMemberRow", (self: any, args: any, res: any) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;
                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

                  // Vendetta stili: flexDirection: "row" olan ve statüleri tutan view'u bul.
                  const statusView = findInReactTree(res, (n) => n?.props?.style?.flexDirection === "row");
                  if (statusView && Array.isArray(statusView.props?.children)) {
                      statusView.props.children.push(icons);
                  } else {
                      // Eğer bulamazsa, en üst düzeyde ismin yanına zorla ekle
                      return (
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ flex: 1 }}>{res}</View>
                              {icons}
                          </View>
                      );
                  }
              } catch (e) {}
              return res;
          });
      }

      // Kullanıcı Profili Üst Bilgisi (Profile)
      const UserProfile = getByProps("UserProfilePrimaryInfo");
      if (UserProfile) {
          patchComponent(UserProfile, "default", (self: any, args: any, res: any) => {
              try {
                  const user = args[0]?.user;
                  if (!user) return res;
                  const icons = getPlatformIcons(user.id);
                  if (!icons) return res;

                  return (
                      <View>
                          {res}
                          <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'center' }}>{icons}</View>
                      </View>
                  );
              } catch(e) {}
              return res;
          });
      }

      // Sohbet İçi Mesajlar
      const MessageHeader = getByProps("MessageTimestamp");
      if (MessageHeader) {
          patchComponent(MessageHeader, "default", (self: any, args: any, res: any) => {
              try {
                  const message = args[0]?.message;
                  if (!message || !message.author) return res;
                  const icons = getPlatformIcons(message.author.id);
                  if (!icons) return res;

                  const headerRow = findInReactTree(res, (n) => n?.props?.children && Array.isArray(n.props.children) && n.props.children.length > 1);
                  if (headerRow && Array.isArray(headerRow.props.children)) {
                      headerRow.props.children.push(icons);
                  } else {
                      return (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {res}
                              {icons}
                          </View>
                      );
                  }
              } catch(e) {}
              return res;
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
