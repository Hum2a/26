import geometry from "./kart-circuit.json" with { type: "json" };
import { indexWalls, type Wall } from "./kart-driving.ts";

export const importedTrackId = "mario-circuit-v1" as const;
export const importedTrackLimitMs = 180_000;
/** Centreline verified against the pinned GLB road. Used for ordered progress and the broadcast map. */
export const importedRoute: readonly (readonly [number, number])[] = [
  [0,0],[0,-100],[8,-123],[23,-139],[48,-143],[67,-139],[85,-124],[100,-95],[111,-76],[125,-69],[175,-69],[185,-75],[194,-103],[205,-124],[225,-138],[250,-139],[274,-130],[291,-112],[300,-89],[297,-68],[284,-51],[260,-40],[220,-31],[180,-23],[140,-15],[114,-8],[106,-3],[104,9],[109,18],[121,28],[145,30],[255,30],[280,35],[296,48],[303,65],[301,90],[292,107],[278,116],[255,120],[216,120],[207,115],[199,89],[190,85],[143,85],[128,98],[107,117],[82,130],[60,135],[37,134],[20,127],[12,110],[1,74],[0,0],
];
const lengths = importedRoute.slice(1).map((p,i) => Math.hypot(p[0]-importedRoute[i]![0], p[1]-importedRoute[i]![1]));
const offsets = lengths.reduce<number[]>((all, value) => [...all, all.at(-1)! + value], [0]);
export const importedLapLength = offsets.at(-1)!;
export function importedTrackProgress(x: number, z: number) {
  let best = { distance: Infinity, along: 0, heading: -Math.PI/2, x: 0, z: 0 };
  for (let i=0;i<lengths.length;i++) {
    const a=importedRoute[i]!, b=importedRoute[i+1]!, dx=b[0]-a[0], dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(lengths[i]! ** 2)));
    const px=a[0]+dx*t, pz=a[1]+dz*t, distance=Math.hypot(x-px,z-pz);
    if(distance<best.distance) best={distance, along: offsets[i]!+lengths[i]!*t, heading: Math.atan2(dz,dx), x:px,z:pz};
  }
  return best;
}
export const importedWalls: readonly Wall[] = geometry.edges.map(([ax,az,bx,bz]) => ({ ax:ax!,az:az!,bx:bx!,bz:bz! }));
let wallIndex: ReturnType<typeof indexWalls> | undefined;
export function nearbyImportedWalls(x:number,z:number,reach:number) {
  wallIndex ??= indexWalls(importedWalls);
  return wallIndex(x,z,reach);
}
type Triangle = number[][];
let surfaces: Map<string,{triangle:Triangle; road:boolean}[]> | undefined;
function surfaceIndex() {
  if(surfaces) return surfaces;
  surfaces = new Map();
  for(const [triangles,road] of [[geometry.road,true],[geometry.dirt,false]] as const) for(const triangle of triangles) {
    const xs=triangle.map(p=>p[0]!),zs=triangle.map(p=>p[1]!);
    for(let x=Math.floor(Math.min(...xs)/8);x<=Math.floor(Math.max(...xs)/8);x++) for(let z=Math.floor(Math.min(...zs)/8);z<=Math.floor(Math.max(...zs)/8);z++) {
      const key=`${x}:${z}`,cell=surfaces.get(key)??[];cell.push({triangle,road});surfaces.set(key,cell);
    }
  }
  return surfaces;
}
export function importedSurfaceAt(x:number,z:number): "road"|"dirt"|"unsupported" {
  // The visible chequered start-grid strip is a separate GLB mesh, bridging Object_24's seam.
  if(x>=-12&&x<=14&&z>=-34&&z<=-28) return "road";
  let dirt=false;
  for(const {triangle:[a,b,c],road} of surfaceIndex().get(`${Math.floor(x/8)}:${Math.floor(z/8)}`)??[]) {
    const cross=(p:number[],q:number[])=>(q[0]!-p[0]!)*(z-p[1]!)-(q[1]!-p[1]!)*(x-p[0]!);
    const v=[cross(a!,b!),cross(b!,c!),cross(c!,a!)];
    if(v.every(n=>n>=-0.001)||v.every(n=>n<=0.001)) { if(road)return"road"; dirt=true; }
  }
  return dirt?"dirt":"unsupported";
}
