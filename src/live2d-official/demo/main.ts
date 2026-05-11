/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';

let actionPresets: Record<
  string,
  {
    durationMs?: number;
    params?: Record<string, number>;
  }
> = {};

async function loadActionPresets() {
  try {
    const response = await fetch(`${LAppDefine.ResourcesPath}actions.json`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    actionPresets = data.actions || {};
  } catch {
    actionPresets = {};
  }
}

/**
 * ブラウザロード後の処理
 */
window.addEventListener(
  'load',
  (): void => {
    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
      return;
    }

    void loadActionPresets();
    LAppDelegate.getInstance().run();
  },
  { passive: true }
);

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type !== 'LIVE2D_ACTION') {
    return;
  }

  const actionName = event.data?.payload?.action;
  if (!actionName || !actionPresets[actionName]) {
    return;
  }

  LAppDelegate.getInstance()
    .getLive2DManager()
    ?.triggerActionPreset(actionPresets[actionName]);
});

/**
 * 終了時の処理
 */
window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);
