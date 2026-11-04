// Original linear-light kernel. Keep its mathematical reference in look-grade.ts in sync.
export const lookVertexShader = `
varying vec2 lookUv;
void main(){ lookUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;
export const lookFragmentShader = `
uniform sampler2D sourceImage;
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
void main(){
  vec4 source=texture2D(sourceImage,lookUv);
  vec3 c=channelMixer*source.rgb;
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
  gl_FragColor=vec4(pow(max(c,vec3(0.0)),vec3(1.0/gradeA.w)),source.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
