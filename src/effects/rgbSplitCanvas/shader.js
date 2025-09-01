export const vert = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const frag = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2  uRes;
  uniform vec2  uMouse;       // 0..1 (Y već flipovan u JS-u)
  uniform float uTime;
  uniform float uIntensity;
  uniform float uFalloffStart;
  uniform float uNoiseFreq;
  uniform float uNoiseSpeed;
  uniform vec3  uMix;         // koji kanali su aktivni (1/0 po R,G,B)

  // NOVO za fit & anchor
  uniform vec2 uTexSize;      // tekstura (w,h)
  uniform vec2 uCanvasSize;   // canvas (w,h)
  uniform int  uFitMode;      // 0=cover, 1=contain
  uniform vec2 uAnchor;       // (0,0)=top-left, (1,1)=bottom-right

  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1.0,0.0));
    float c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }

  // helper za uv transformaciju
  vec2 coverContainUV(vec2 uv){
    vec2 C = uCanvasSize; // canvas dim
    vec2 T = uTexSize;    // texture dim
    float kx = C.x / T.x;
    float ky = C.y / T.y;
    float k = (uFitMode == 1) ? min(kx, ky) : max(kx, ky);
    vec2 D = T * k; // dim slike koja se prikazuje

    vec2 extraCover   = max(D - C, vec2(0.0)); // crop višak
    vec2 extraContain = max(C - D, vec2(0.0)); // letterbox praznina
    vec2 offsetCover   = extraCover * uAnchor;
    vec2 offsetContain = extraContain * uAnchor;

    vec2 p = uv * C;
    vec2 inImagePx = (uFitMode == 1) ? (p - offsetContain) : (p + offsetCover);
    vec2 inImageUV = inImagePx / D;
    return inImageUV;
  }

  void main(){
    // koristi transformisani uv
    vec2 uv = coverContainUV(vUv);

    vec2 m = uMouse;
    vec2 dir = uv - m;
    float dist = length(dir);
    float falloff = smoothstep(uFalloffStart, 0.0, dist);

    float n = noise(uv * uNoiseFreq + uTime * uNoiseSpeed);
    vec2 warp = normalize(dir) * uIntensity * falloff + (n - 0.5) * uIntensity * falloff;

    vec2 rUV = uv - warp;
    vec2 gUV = uv;
    vec2 bUV = uv + warp;

    vec3 col;
    col.r = texture2D(uTex, rUV).r * uMix.r;
    col.g = texture2D(uTex, gUV).g * uMix.g;
    col.b = texture2D(uTex, bUV).b * uMix.b;

    float vign = smoothstep(0.9, 0.2, dist);
    col *= mix(1.0, 0.965, vign);

    gl_FragColor = vec4(col, 1.0);
  }
`;
