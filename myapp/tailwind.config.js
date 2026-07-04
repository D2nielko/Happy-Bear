/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				bear: {
					cream: '#FFF8E7',
					light: '#F5E6C8',
					tan: '#D4A574',
					brown: '#8B6914',
					dark: '#5C4033',
					nose: '#4A3728',
					blush: '#FFB6C1'
				},
				warm: {
					50: '#FFFBF0',
					100: '#FFF3D6',
					200: '#FFE4A8',
					300: '#FFD07A',
					400: '#FFBA4C',
					500: '#FFA01E',
					600: '#E08600',
					700: '#B36B00',
					800: '#865000',
					900: '#593500'
				}
			},
			fontFamily: {
				comfortaa: ['Comfortaa', 'cursive'],
				poppins: ['Poppins', 'sans-serif']
			},
			animation: {
				breathe: 'breathe 3s ease-in-out infinite',
				'bounce-gentle': 'bounceGentle 0.6s ease-in-out',
				wiggle: 'wiggle 0.5s ease-in-out',
				'float-up': 'floatUp 1.5s ease-out forwards',
				'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
			},
			keyframes: {
				breathe: {
					'0%, 100%': { transform: 'scaleY(1) translateY(0)' },
					'50%': { transform: 'scaleY(1.02) translateY(-2px)' }
				},
				bounceGentle: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				wiggle: {
					'0%, 100%': { transform: 'rotate(0deg)' },
					'25%': { transform: 'rotate(-5deg)' },
					'75%': { transform: 'rotate(5deg)' }
				},
				floatUp: {
					'0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
					'100%': { opacity: '0', transform: 'translateY(-60px) scale(1.5)' }
				},
				pulseSoft: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				}
			}
		}
	},
	plugins: []
};
