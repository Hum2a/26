// Original linear-light kernel. Keep its mathematical reference in look-grade.ts in sync.
export const lookVertexShader = `
varying vec2 lookUv;
void main(){ lookUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;
export const lookFragmentShader = `
uniform sampler2D sourceImage;
uniform sampler2D depthImage;
uniform vec2 inverseResolution;
uniform vec4 opticsA;
uniform vec4 opticsB;
uniform vec2 focusDepth;
uniform vec3 cameraDepth;
uniform float opticsTime;
uniform float gradeEnabled;
uniform mat3 channelMixer;
uniform vec4 gradeA;
uniform vec4 gradeB;
uniform vec3 gradeC;
uniform vec3 bands[8];
uniform float centres[8];
uniform vec3 shadowColour;
uniform vec3 highlightColour;
uniform vec2 split;
varying vec2 lookUv;
vec3 toHsl(vec3 c){
  float hi=max(c.r,max(c.g,c.b)),lo=min(c.r,min(c.g,c.b)),d=hi-lo,l=(hi+lo)*0.5;
  if(d<0.00000001)return vec3(0.0,0.0,l);
  float h=hi==c.r?mod((c.g-c.b)/d+6.0,6.0):hi==c.g?(c.b-c.r)/d+2.0:(c.r-c.g)/d+4.0;
  return vec3(h/6.0,d/max(0.00000001,1.0-abs(2.0*l-1.0)),l);
}
vec3 fromHsl(vec3 hsl){
  float c=(1.0-abs(2.0*hsl.z-1.0))*hsl.y,v=fract(hsl.x)*6.0,x=c*(1.0-abs(mod(v,2.0)-1.0));
  vec3 rgb=v<1.0?vec3(c,x,0.0):v<2.0?vec3(x,c,0.0):v<3.0?vec3(0.0,c,x):v<4.0?vec3(0.0,x,c):v<5.0?vec3(x,0.0,c):vec3(c,0.0,x);
  return rgb+vec3(hsl.z-c*0.5);
}
vec2 boundedUv(vec2 uv){return clamp(uv,inverseResolution*0.5,vec2(1.0)-inverseResolution*0.5);}
float viewDepth(float d){
  return cameraDepth.z>0.5
    ? cameraDepth.x*cameraDepth.y/max(0.0001,cameraDepth.y-d*(cameraDepth.y-cameraDepth.x))
    : mix(cameraDepth.x,cameraDepth.y,d);
}
vec3 opticalColour(vec4 source){
  vec2 radial=lookUv-vec2(0.5);
  float radius=length(radial)*1.41421356;
  // Keep wind, colour splitting, dirt and defocus off the centre racing line.
  float edge=smoothstep(0.38,0.92,radius);
  vec3 c=source.rgb;
  if(opticsA.y>0.0){
    vec2 offset=radial/max(0.0001,length(radial))*inverseResolution*opticsA.y*edge;
    c.r=texture2D(sourceImage,boundedUv(lookUv+offset)).r;
    c.b=texture2D(sourceImage,boundedUv(lookUv-offset)).b;
  }
  float depth=0.0,rawDepth=1.0;
  bool needsDepth=opticsB.y>0.0||opticsB.w>0.0;
  if(needsDepth){rawDepth=texture2D(depthImage,lookUv).x;depth=viewDepth(rawDepth);}
  vec3 bloom=max(source.rgb-vec3(opticsB.x),vec3(0.0));
  vec3 blur=source.rgb;float blurWeight=1.0,occlusion=0.0;
  float sampleRadius=opticsB.y>0.0?opticsB.z:3.0;
  if(opticsA.w>0.0||needsDepth){
    for(int i=0;i<4;i++){
      vec2 direction=i==0?vec2(1.0,0.0):i==1?vec2(-1.0,0.0):i==2?vec2(0.0,1.0):vec2(0.0,-1.0);
      vec2 uv=boundedUv(lookUv+direction*inverseResolution*sampleRadius);
      float neighbourDepth=depth;
      if(needsDepth){
        neighbourDepth=viewDepth(texture2D(depthImage,uv).x);
        float delta=depth-neighbourDepth;
        occlusion+=smoothstep(0.02,0.15,delta)*(1.0-smoothstep(0.6,2.0,delta))*0.25;
      }
      if(opticsA.w>0.0||opticsB.w>0.0){
        vec3 neighbour=texture2D(sourceImage,uv).rgb;
        bloom+=max(neighbour-vec3(opticsB.x),vec3(0.0));
        float weight=1.0-smoothstep(0.3,2.0,abs(neighbourDepth-depth));
        blur+=neighbour*weight;blurWeight+=weight;
      }
    }
  }
  if(opticsB.w>0.0){
    float defocus=smoothstep(focusDepth.y*0.5,focusDepth.y,abs(depth-focusDepth.x));
    c=mix(c,blur/blurWeight,defocus*opticsB.w*edge*0.65);
  }
  if(rawDepth<0.99999)c*=1.0-occlusion*opticsB.y;
  c+=min(vec3(1.0),bloom*0.2)*opticsA.w;
  if(opticsA.z>0.0){
    float dirt=smoothstep(0.3,0.95,sin(lookUv.x*107.0+sin(lookUv.y*31.0))*sin(lookUv.y*83.0));
    c*=1.0-dirt*edge*edge*opticsA.z*0.8;
  }
  if(opticsA.x>0.0){
    float angle=atan(radial.y,radial.x);
    float lane=pow(max(0.0,sin(angle*23.0)),16.0);
    float dash=pow(max(0.0,sin(radius*68.0-opticsTime*26.0)),8.0);
    c+=highlightColour*lane*dash*edge*opticsA.x;
  }
  return c;
}
void main(){
  vec4 source=texture2D(sourceImage,lookUv);
  vec3 c=opticalColour(source);
  if(gradeEnabled>0.5){
  c=channelMixer*c;
  c*=vec3(1.0+gradeB.x*0.15,1.0+gradeB.y*0.1,1.0-gradeB.x*0.15)*exp2(gradeA.z);
  c=max(vec3(0.0),(c-vec3(0.18))*gradeA.y+vec3(0.18+gradeA.x));
  float peak=max(1.0,max(c.r,max(c.g,c.b)));
  vec3 hsl=toHsl(c/peak),shift=vec3(0.0);float degrees=hsl.x*360.0;
  for(int i=0;i<8;i++){
    int next=i==7?0:i+1;float hi=i==7?360.0:centres[next];
    if(degrees>=centres[i]&&degrees<hi)shift=mix(bands[i],bands[next],(degrees-centres[i])/(hi-centres[i]));
  }
  hsl.x+=(gradeB.z+shift.x)/360.0;
  hsl.y=clamp(hsl.y*gradeB.w*(1.0+gradeC.x*(1.0-hsl.y))*(1.0+shift.y),0.0,1.0);
  hsl.z=clamp(hsl.z+shift.z,0.0,1.0);c=fromHsl(hsl)*peak;
  float lum=clamp(dot(c,vec3(0.2126,0.7152,0.0722)),0.0,1.0);
  float t=clamp((lum-split.y+0.2)/0.4,0.0,1.0);t=t*t*(3.0-2.0*t);
  c=mix(c,mix(shadowColour,highlightColour,t)*max(0.05,lum),split.x);
  c=pow(max(c,vec3(0.0)),vec3(1.0/gradeA.w));
  }
  gl_FragColor=vec4(c,source.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
