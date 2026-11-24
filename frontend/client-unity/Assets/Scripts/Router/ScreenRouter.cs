//ARXIU QUE GESTIONA QUINA PANTALLA ES VEU EN CADA MOMENT

//=====================
//IMPORTEM
//=====================
using System.Collections.Generic;
using UnityEngine.UIElements;

//=====================
//NAMESPACE: ROUTER
//=====================
namespace Router
{
    //=====================
    //CLASSE: SCREENROUTER
    //GUARDA TOTES LES PANTALLES REGISTRADES I N'ENSENYA UNA CADA COP
    //=====================
    public class ScreenRouter
    {
        //ESTAT INTERN: PANTALLES REGISTRADES I LA QUE ES VEU ARA
        private readonly Dictionary<string, VisualElement> screens = new Dictionary<string, VisualElement>();
        private VisualElement currentScreen;

        //=====================
        //MÈTODE: REGISTRA UNA PANTALLA AMB EL SEU NOM
        //LA DEIXA AMAGADA FINS QUE NO ES DEMANI MOSTRAR-LA
        //=====================
        public void Register(string screenName, VisualElement element)
        {
            //SI L'ELEMENT NO EXISTEIX NO EL REGISTREM
            if (element == null)
            {
                return;
            }

            screens[screenName] = element;
            element.style.display = DisplayStyle.None;
        }

        //=====================
        //MÈTODE: MOSTRA UNA PANTALLA I AMAGA L'ANTERIOR
        //=====================
        public void Show(string screenName)
        {
            //SI LA PANTALLA NO ESTÀ REGISTRADA HO AVISEM I NO CANVIEM RES
            bool isRegistered = screens.ContainsKey(screenName);
            if (isRegistered == false)
            {
                UnityEngine.Debug.LogError("ScreenRouter: La pantalla '" + screenName + "' no está registrada.");
                return;
            }

            //AMAGUEM LA PANTALLA QUE ES VEU ARA
            if (currentScreen != null)
            {
                currentScreen.style.display = DisplayStyle.None;
            }

            //ENSENYEM LA NOVA
            currentScreen = screens[screenName];
            currentScreen.style.display = DisplayStyle.Flex;
        }
    }
}
