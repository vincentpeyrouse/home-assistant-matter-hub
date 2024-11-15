import {
  ColorConverter,
  HomeAssistantEntityState,
  LightDeviceAttributes,
  LightDeviceColorMode,
} from "@home-assistant-matter-hub/common";
import { ColorControlServer as Base } from "@matter/main/behaviors/color-control";
import { ColorControl } from "@matter/main/clusters";
import { HomeAssistantBehavior } from "../custom-behaviors/home-assistant-behavior.js";

export class ColorTemperatureControlServer extends Base.with(
  "ColorTemperature",
) {
  override async initialize() {
    await super.initialize();

    const homeAssistant = await this.agent.load(HomeAssistantBehavior);
    const state = homeAssistant.state
      .entity as HomeAssistantEntityState<LightDeviceAttributes>;
    const minKelvin = state.attributes.min_color_temp_kelvin ?? 1500;

    const maxKelvin = state.attributes.max_color_temp_kelvin ?? 8000;
    this.state.coupleColorTempToLevelMinMireds = Math.floor(
      ColorConverter.temperatureKelvinToMireds(maxKelvin),
    );
    this.state.colorTempPhysicalMinMireds = Math.floor(
      ColorConverter.temperatureKelvinToMireds(maxKelvin),
    );
    this.state.colorTempPhysicalMaxMireds = Math.ceil(
      ColorConverter.temperatureKelvinToMireds(minKelvin),
    );
    this.state.startUpColorTemperatureMireds =
      ColorConverter.temperatureKelvinToMireds(
        state.attributes.color_temp_kelvin ?? maxKelvin,
      );
    if (state.attributes.color_temp_kelvin) {
      this.state.colorTemperatureMireds =
        ColorConverter.temperatureKelvinToMireds(
          state.attributes.color_temp_kelvin,
        );
    }
    homeAssistant.onUpdate((s) => this.update(s));
  }

  protected async update(
    state: HomeAssistantEntityState<LightDeviceAttributes>,
  ) {
    const current = this.endpoint.stateOf(ColorTemperatureControlServer);
    if (state.attributes.color_mode === LightDeviceColorMode.COLOR_TEMP) {
      let kelvin = state.attributes.color_temp_kelvin;
      const minKelvin = state.attributes.min_color_temp_kelvin ?? 1500;
      const maxKelvin = state.attributes.max_color_temp_kelvin ?? 8000;
      if (kelvin != null) {
        kelvin = Math.max(Math.min(kelvin, maxKelvin), minKelvin);
        const mireds = ColorConverter.temperatureKelvinToMireds(kelvin);
        if (mireds != current.colorTemperatureMireds) {
          await this.endpoint.setStateOf(ColorTemperatureControlServer, {
            colorTemperatureMireds: mireds,
          });
        }
      }
    }
  }

  override async moveToColorTemperature(
    request: ColorControl.MoveToColorTemperatureRequest,
  ) {
    const homeAssistant = this.agent.get(HomeAssistantBehavior);
    const targetKelvin = ColorConverter.temperatureMiredsToKelvin(
      request.colorTemperatureMireds,
    );
    await super.moveToColorTemperature({
      ...request,
      transitionTime: request.transitionTime ?? 1,
    });
    await homeAssistant.callAction(
      "light",
      "turn_on",
      {
        color_temp_kelvin: targetKelvin,
      },
      {
        entity_id: homeAssistant.state.entity.entity_id,
      },
    );
  }
}
