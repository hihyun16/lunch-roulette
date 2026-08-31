import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 배포 시 레포지토리 이름이 주소 경로에 들어가므로 base를 지정합니다.
  // 레포지토리 이름을 'lunch-roulette'로 만든다고 가정합니다.
  base: '/lunch-roulette/',
});
