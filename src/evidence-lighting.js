// 原始照片像素坐标的归一化标记；在等比裁切后转换到照片局部坐标。
// 只标记手机以及它朝向的脸部，冰箱等无手机照片没有发光区域。
export const evidenceLighting = {
  fridge: { source: [1076, 1461], emitters: [] },
  man: { source: [1024, 1536], emitters: [{ phone: [.79, .725], face: [.735, .55], angle: -8 }] },
  cafe: { source: [941, 1672], emitters: [{ phone: [.79, .615], face: [.60, .365], angle: -48 }] },
  commuters: { source: [1492, 1054], emitters: [
    { phone: [.185, .70], face: [.177, .355], angle: 20 },
    { phone: [.315, .725], face: [.393, .405], angle: 38 },
    { phone: [.475, .65], face: [.692, .365], angle: 48 }
  ] },
  desk: { source: [1178, 1335], emitters: [{ phone: [.45, .257], face: [.19, .105], angle: -8 }] },
  girl: { source: [1024, 1536], emitters: [{ phone: [.342, .847], face: [.258, .66], angle: -8 }] },
  table: { source: [1825, 862], emitters: [{ phone: [.445, .438], angle: 90 }] }
};
