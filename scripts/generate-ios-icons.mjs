import sharp from 'sharp';
import fs from 'fs';

const input = 'public/favicon.svg';
const outDir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';

const icons = [
  ['icon-20@2x.png', 40],
  ['icon-20@3x.png', 60],
  ['icon-29@2x.png', 58],
  ['icon-29@3x.png', 87],
  ['icon-40@2x.png', 80],
  ['icon-40@3x.png', 120],
  ['icon-60@2x.png', 120],
  ['icon-60@3x.png', 180],
  ['icon-76@1x.png', 76],
  ['icon-76@2x.png', 152],
  ['icon-83.5@2x.png', 167],
  ['icon-1024@1x.png', 1024],
];

for (const [name, size] of icons) {
  await sharp(input)
    .resize(size, size)
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(`${outDir}/${name}`);
}

const contents = {
  images: [
    { size: '20x20', idiom: 'iphone', filename: 'icon-20@2x.png', scale: '2x' },
    { size: '20x20', idiom: 'iphone', filename: 'icon-20@3x.png', scale: '3x' },
    { size: '29x29', idiom: 'iphone', filename: 'icon-29@2x.png', scale: '2x' },
    { size: '29x29', idiom: 'iphone', filename: 'icon-29@3x.png', scale: '3x' },
    { size: '40x40', idiom: 'iphone', filename: 'icon-40@2x.png', scale: '2x' },
    { size: '40x40', idiom: 'iphone', filename: 'icon-40@3x.png', scale: '3x' },
    { size: '60x60', idiom: 'iphone', filename: 'icon-60@2x.png', scale: '2x' },
    { size: '60x60', idiom: 'iphone', filename: 'icon-60@3x.png', scale: '3x' },
    { size: '76x76', idiom: 'ipad', filename: 'icon-76@1x.png', scale: '1x' },
    { size: '76x76', idiom: 'ipad', filename: 'icon-76@2x.png', scale: '2x' },
    { size: '83.5x83.5', idiom: 'ipad', filename: 'icon-83.5@2x.png', scale: '2x' },
    { size: '1024x1024', idiom: 'ios-marketing', filename: 'icon-1024@1x.png', scale: '1x' }
  ],
  info: { version: 1, author: 'xcode' }
};

fs.writeFileSync(`${outDir}/Contents.json`, JSON.stringify(contents, null, 2));
