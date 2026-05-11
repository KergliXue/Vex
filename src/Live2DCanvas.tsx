import { useEffect, useMemo, useRef } from 'react';

interface Live2DCanvasProps {
  modelPath: string;
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  topPadding: number;
  action?: {
    name: string;
    nonce: number;
  } | null;
}

export default function Live2DCanvas({
  modelPath,
  scale,
  width,
  height,
  offsetX,
  topPadding,
  action,
}: Live2DCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const src = useMemo(() => {
    const params = new URLSearchParams({
      modelPath,
      scale: String(scale),
    });
    return `/live2d.html?${params.toString()}`;
  }, [modelPath, scale]);

  useEffect(() => {
    if (!action || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      {
        type: 'LIVE2D_ACTION',
        payload: {
          action: action.name,
        },
      },
      '*'
    );
  }, [action]);

  return (
    <div
      className="live2d-stage"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        right: `${offsetX}px`,
        top: `${topPadding}px`,
      }}
      title={modelPath ? `Live2D 模型: ${modelPath}` : '未配置 Live2D 模型'}
    >
      <iframe
        ref={iframeRef}
        className="live2d-frame"
        src={src}
        aria-label="Live2D avatar"
      />
    </div>
  );
}
