import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // EN BÜYÜK ŞÜPHEM: Enmity'nin içine koyduğum arama motoru eklentiyi tamamen çökertiyor olabilir.
      // Eklenti çalışmıyor değil, hatalı bir kod yüzünden daha "onStart" kısmında sessizce çöküyor!
      // Bunu %100 kanıtlamak için eklentideki her şeyi sildim ve sadece tek 1 satırlık, hata vermesi
      // İMKANSIZ olan bir kod bıraktım. Bu kod daha önceki eklentinde başarıyla çalışmıştı.

      const Dispatcher = getByProps('dispatch', 'subscribe');
      
      if (Dispatcher) {
          Patcher.before(Dispatcher, 'dispatch', (self, args) => {
              try {
                  const event = args[0];
                  // Eğer bir mesaj geliyorsa veya yükleniyorsa
                  if (event && (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE")) {
                      if (event.message && typeof event.message.content === "string") {
                          if (!event.message.content.includes("ENMITY ÇALIŞIYOR")) {
                              event.message.content += "\n[ENMITY ÇALIŞIYOR]";
                          }
                      }
                  }
              } catch (e) {}
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
