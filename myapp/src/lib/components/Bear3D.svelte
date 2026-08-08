<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { bearEmotion } from '$lib/stores/chat.js';
	import type { InteractionType } from '$lib/types.js';
	import type * as THREE_NS from 'three';

	const dispatch = createEventDispatcher<{ interact: InteractionType }>();

	let container: HTMLDivElement;
	let emotion = 'idle';
	$: emotion = $bearEmotion;

	// Active gesture animation: name + start time (seconds on the scene clock)
	let gesture: { name: InteractionType | 'bounce'; start: number } | null = null;
	let isAnimating = false;

	const FUR = 0xd4a564;
	const FUR_LIGHT = 0xe8c99b;
	const DARK = 0x5c4033;
	const BLUSH = 0xffb6c1;

	function handleZoneClick(zone: InteractionType, clockTime: number) {
		if (isAnimating) return;
		isAnimating = true;
		gesture = { name: zone, start: clockTime };
		dispatch('interact', zone);
		setTimeout(() => (isAnimating = false), 900);
	}

	onMount(() => {
		let disposed = false;
		let cleanup = () => {};

		(async () => {
			const THREE = await import('three');
			if (disposed) return;

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
			camera.position.set(0, 2.1, 7);
			camera.lookAt(0, 1.55, 0);

			const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			container.appendChild(renderer.domElement);

			scene.add(new THREE.HemisphereLight(0xfff5e6, 0x8a7355, 1.4));
			const sun = new THREE.DirectionalLight(0xffffff, 1.6);
			sun.position.set(3, 5, 4);
			scene.add(sun);

			const fur = new THREE.MeshStandardMaterial({ color: FUR, roughness: 0.9 });
			const furLight = new THREE.MeshStandardMaterial({ color: FUR_LIGHT, roughness: 0.9 });
			const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 });

			const sphere = (mat: THREE_NS.Material, r: number, sx = 1, sy = 1, sz = 1): THREE_NS.Mesh => {
				const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
				m.scale.set(sx, sy, sz);
				return m;
			};

			const root = new THREE.Group();
			scene.add(root);

			// Body + belly
			const body = sphere(fur, 1, 1, 1.15, 0.85);
			body.position.y = 1.15;
			body.userData.zone = 'hug';
			root.add(body);
			const belly = sphere(furLight, 0.72, 1, 1.05, 0.6);
			belly.position.set(0, 1.1, 0.45);
			belly.userData.zone = 'belly_rub';
			root.add(belly);

			// Head
			const headGroup = new THREE.Group();
			headGroup.position.set(0, 2.4, 0);
			root.add(headGroup);
			const head = sphere(fur, 0.75, 1.05, 1, 0.95);
			head.userData.zone = 'pat_head';
			headGroup.add(head);
			const muzzle = sphere(furLight, 0.34, 1.15, 0.85, 0.7);
			muzzle.position.set(0, -0.2, 0.62);
			muzzle.userData.zone = 'pat_head';
			headGroup.add(muzzle);
			const nose = sphere(dark, 0.13, 1.2, 0.9, 0.8);
			nose.position.set(0, -0.08, 0.88);
			nose.userData.zone = 'nose_boop';
			headGroup.add(nose);
			// Invisible pick target: the drawn nose is too small to click comfortably,
			// so boops register anywhere over the muzzle front.
			const noseHit = new THREE.Mesh(
				new THREE.SphereGeometry(0.3, 16, 12),
				new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
			);
			noseHit.position.set(0, -0.12, 0.82);
			noseHit.userData.zone = 'nose_boop';
			headGroup.add(noseHit);

			// Ears (own pivots so they can wiggle)
			const ears: THREE_NS.Group[] = [];
			for (const side of [-1, 1]) {
				const earGroup = new THREE.Group();
				earGroup.position.set(side * 0.55, 0.62, 0);
				const ear = sphere(fur, 0.26);
				ear.userData.zone = 'pat_head';
				earGroup.add(ear);
				const inner = sphere(furLight, 0.15);
				inner.position.z = 0.13;
				inner.userData.zone = 'pat_head';
				earGroup.add(inner);
				headGroup.add(earGroup);
				ears.push(earGroup);
			}

			// Eyes (scale.y squishes them into happy crescents / sleepy lines)
			const eyes: THREE_NS.Mesh[] = [];
			for (const side of [-1, 1]) {
				const eye = sphere(dark, 0.075);
				eye.position.set(side * 0.28, 0.12, 0.64);
				eye.userData.zone = 'pat_head';
				headGroup.add(eye);
				eyes.push(eye);
			}

			// Mouth: half-torus, flipped for frown, scaled for O
			const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 12, 24, Math.PI), dark);
			mouth.position.set(0, -0.32, 0.72);
			mouth.rotation.z = Math.PI; // arc opens upward = smile
			headGroup.add(mouth);

			// Blush
			const blushMats: THREE_NS.MeshBasicMaterial[] = [];
			for (const side of [-1, 1]) {
				const mat = new THREE.MeshBasicMaterial({
					color: BLUSH,
					transparent: true,
					opacity: 0
				});
				const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), mat);
				cheek.position.set(side * 0.45, -0.08, 0.63);
				headGroup.add(cheek);
				blushMats.push(mat);
			}

			// Arms: pivot at shoulder, mesh hangs down — rotating the group swings the limb
			const arms: THREE_NS.Group[] = [];
			for (const side of [-1, 1]) {
				const armGroup = new THREE.Group();
				armGroup.position.set(side * 0.95, 1.75, 0);
				const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 8, 16), fur);
				arm.position.set(side * 0.08, -0.45, 0.05);
				arm.userData.zone = 'hug';
				armGroup.add(arm);
				const paw = sphere(furLight, 0.17, 1, 0.8, 1);
				paw.position.set(side * 0.1, -0.78, 0.15);
				paw.userData.zone = 'hug';
				armGroup.add(paw);
				root.add(armGroup);
				arms.push(armGroup);
			}

			// Legs: pivot at hip
			const legs: THREE_NS.Group[] = [];
			for (const side of [-1, 1]) {
				const legGroup = new THREE.Group();
				legGroup.position.set(side * 0.52, 0.5, 0.15);
				const leg = sphere(fur, 0.34, 1, 0.9, 1.2);
				leg.position.set(0, -0.28, 0.25);
				leg.userData.zone = 'hug';
				legGroup.add(leg);
				const pad = sphere(furLight, 0.19, 1, 0.9, 0.5);
				pad.position.set(0, -0.3, 0.62);
				pad.userData.zone = 'hug';
				legGroup.add(pad);
				root.add(legGroup);
				legs.push(legGroup);
			}

			// Picking
			const raycaster = new THREE.Raycaster();
			const pointer = new THREE.Vector2();
			const clock = new THREE.Clock();

			function zoneAt(event: PointerEvent): InteractionType | null {
				const rect = renderer.domElement.getBoundingClientRect();
				pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
				pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
				raycaster.setFromCamera(pointer, camera);
				const hits = raycaster.intersectObjects(root.children, true);
				for (const hit of hits) {
					let obj: THREE_NS.Object3D | null = hit.object;
					while (obj) {
						if (obj.userData.zone) return obj.userData.zone as InteractionType;
						obj = obj.parent;
					}
				}
				return null;
			}

			const onClick = (e: PointerEvent) => {
				const zone = zoneAt(e);
				if (zone) handleZoneClick(zone, clock.getElapsedTime());
			};
			const onMove = (e: PointerEvent) => {
				const zone = zoneAt(e);
				renderer.domElement.style.cursor = zone ? 'pointer' : 'default';
				// Exposed so tests can assert which zone a pixel maps to.
				renderer.domElement.dataset.zone = zone ?? '';
			};
			renderer.domElement.addEventListener('pointerdown', onClick);
			renderer.domElement.addEventListener('pointermove', onMove);

			// Decaying oscillation: swings `cycles` times over the gesture, fading to 0
			const osc = (p: number, cycles: number) => Math.sin(p * Math.PI * cycles) * (1 - p);
			// Single swell: 0 → 1 → 0
			const swell = (p: number) => Math.sin(p * Math.PI);
			const GESTURE_SECS = 1.1;

			let rafId = 0;
			const animate = () => {
				rafId = requestAnimationFrame(animate);
				const t = clock.getElapsedTime();

				// Idle base pose (breathing, gentle sway)
				const breathe = 1 + 0.02 * Math.sin(t * 2);
				body.scale.set(1 * breathe, 1.15 * breathe, 0.85 * breathe);
				root.rotation.set(0, 0, 0);
				root.position.y = 0;
				root.scale.setScalar(1);
				headGroup.rotation.set(0, 0, 0.03 * Math.sin(t * 0.8));
				arms[0].rotation.set(0, 0, 0.22 + 0.05 * Math.sin(t * 1.5));
				arms[1].rotation.set(0, 0, -0.22 - 0.05 * Math.sin(t * 1.5 + 1));
				legs[0].rotation.set(-0.15, 0, 0.1);
				legs[1].rotation.set(-0.15, 0, -0.1);
				ears[0].rotation.z = 0.04 * Math.sin(t * 1.2);
				ears[1].rotation.z = -0.04 * Math.sin(t * 1.2);

				// Gesture overlays
				if (gesture) {
					const p = (t - gesture.start) / GESTURE_SECS;
					if (p >= 1) {
						gesture = null;
					} else {
						switch (gesture.name) {
							case 'pat_head':
								// Lean into the pat: head nod, ears flap, arms lift happily
								headGroup.rotation.x = 0.3 * osc(p, 3);
								ears[0].rotation.z += 0.5 * osc(p, 5);
								ears[1].rotation.z -= 0.5 * osc(p, 5);
								arms[0].rotation.z += 1.5 * swell(p);
								arms[1].rotation.z -= 1.5 * swell(p);
								break;
							case 'hug':
								// Arms squeeze forward, whole bear swells
								arms[0].rotation.x = -1.2 * swell(p);
								arms[1].rotation.x = -1.2 * swell(p);
								arms[0].rotation.z = 0.05;
								arms[1].rotation.z = -0.05;
								root.scale.setScalar(1 + 0.06 * swell(p));
								headGroup.rotation.z += 0.15 * swell(p);
								break;
							case 'nose_boop':
								// Startled recoil
								headGroup.rotation.x = -0.35 * osc(p, 2);
								root.rotation.x = -0.06 * osc(p, 2);
								arms[0].rotation.z += 0.8 * osc(p, 2);
								arms[1].rotation.z -= 0.8 * osc(p, 2);
								break;
							case 'belly_rub':
								// Giggly wriggle, legs kick alternately
								legs[0].rotation.x = -0.15 - 0.8 * Math.abs(osc(p, 3));
								legs[1].rotation.x = -0.15 - 0.8 * Math.abs(osc(p + 0.17, 3));
								root.rotation.z = 0.07 * osc(p, 4);
								break;
							case 'bounce':
								root.position.y = 0.25 * Math.abs(osc(p, 3));
								break;
						}
					}
				}

				// Emotion-driven face
				let eyeY = 1;
				let mouthFlip = Math.PI; // smile
				let mouthScale = 1;
				let blush = 0;
				switch (emotion) {
					case 'happy':
					case 'hugged':
						eyeY = 0.25;
						mouthScale = 1.3;
						blush = 0.6;
						break;
					case 'excited':
						eyeY = 0.25;
						mouthScale = 1.5;
						blush = 0.6;
						break;
					case 'sad':
						eyeY = 0.7;
						mouthFlip = 0; // frown
						mouthScale = 0.8;
						break;
					case 'sleepy':
						eyeY = 0.12;
						mouthScale = 0.7;
						break;
					case 'boop':
						eyeY = 1.35;
						mouthScale = 0.5;
						break;
				}
				for (const eye of eyes) {
					eye.scale.y += (eyeY - eye.scale.y) * 0.15;
				}
				mouth.rotation.z += (mouthFlip - mouth.rotation.z) * 0.15;
				const ms = mouth.scale.x + (mouthScale - mouth.scale.x) * 0.15;
				mouth.scale.set(ms, ms, ms);
				for (const mat of blushMats) {
					mat.opacity += (blush - mat.opacity) * 0.1;
				}

				renderer.render(scene, camera);
			};

			const resize = () => {
				const w = container.clientWidth;
				const h = container.clientHeight;
				if (!w || !h) return;
				renderer.setSize(w, h);
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
			};
			const ro = new ResizeObserver(resize);
			ro.observe(container);
			resize();
			animate();

			// Excitement from chat replies triggers a bounce even without a click
			const unsubscribe = bearEmotion.subscribe((value) => {
				if (value === 'excited' && !gesture) {
					gesture = { name: 'bounce', start: clock.getElapsedTime() };
				}
			});

			cleanup = () => {
				cancelAnimationFrame(rafId);
				ro.disconnect();
				unsubscribe();
				renderer.domElement.removeEventListener('pointerdown', onClick);
				renderer.domElement.removeEventListener('pointermove', onMove);
				scene.traverse((obj) => {
					const mesh = obj as THREE_NS.Mesh;
					if (mesh.geometry) mesh.geometry.dispose();
					if (mesh.material) {
						(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) =>
							m.dispose()
						);
					}
				});
				renderer.dispose();
				renderer.domElement.remove();
			};
		})();

		return () => {
			disposed = true;
			cleanup();
		};
	});
</script>

<div bind:this={container} class="w-full aspect-[4/5] max-w-[360px] mx-auto select-none" />
