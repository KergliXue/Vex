import { useMemo } from 'react';

interface Live2DCanvasProps {
  modelPath: string;
  scale: number;
}

export default function Live2DCanvas({ modelPath, scale }: Live2DCanvasProps) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      modelPath,
      scale: String(scale),
    });
    return `/live2d.html?${params.toString()}`;
  }, [modelPath, scale]);

  return (
    <div className="live2d-stage" title={modelPath ? `Live2D 模型: ${modelPath}` : '未配置 Live2D 模型'}>
      <iframe
        className="live2d-frame"
        src={src}
        aria-label="Live2D avatar"
      />
    </div>
  );
}
