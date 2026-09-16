'use client';

import Link from 'next/link';
import React, { useEffect, useRef } from 'react';
import { Dancing_Script } from 'next/font/google';

const dancingScript = Dancing_Script({ weight: '700', subsets: ['latin'] });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreeLib = any;

declare global {
  interface Window {
    THREE?: ThreeLib;
  }
}

export type ModernAuthLayoutProps = {
  mode: 'login' | 'register';
  children: React.ReactNode;
};

const BG = '#000000';
const CARD = '#0a0a0a';
const SURFACE = '#111111';
const BORDER = '#262626';

export const authInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  background: SURFACE,
  color: '#fff',
  fontSize: '0.875rem',
  outline: 'none',
};

export const authSubmitStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem',
  borderRadius: 6,
  border: 'none',
  background: '#ededed',
  color: '#000',
  fontWeight: 500,
  fontSize: '0.875rem',
  cursor: 'pointer',
};

export const authErrorStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  borderRadius: 6,
  border: '1px solid #7f1d1d',
  background: 'rgba(127, 29, 29, 0.2)',
  color: '#fca5a5',
  fontSize: '0.8rem',
  textAlign: 'left',
};



function DotCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let renderer: ThreeLib | null = null;
    let geometry: ThreeLib | null = null;
    let material: ThreeLib | null = null;
    let animationId = 0;
    let removeResize: (() => void) | undefined;

    const initThree = (THREE: ThreeLib) => {
      if (!canvasRef.current || !active) return;

      const canvas = canvasRef.current;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const uniforms = {
        u_time: { value: 0 },
        u_resolution: {
          value: new THREE.Vector2(window.innerWidth * 2, window.innerHeight * 2),
        },
        u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
        u_colors: {
          value: [
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(1, 1, 1),
          ],
        },
        u_total_size: { value: 20.0 },
        u_dot_size: { value: 6.0 },
        u_reverse: { value: 0 },
      };

      material = new THREE.ShaderMaterial({
        vertexShader: `
          precision mediump float;
          uniform vec2 u_resolution;
          out vec2 fragCoord;
          void main() {
            gl_Position = vec4(position, 1.0);
            fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }
        `,
        fragmentShader: `
          precision mediump float;
          in vec2 fragCoord;

          uniform float u_time;
          uniform float u_opacities[10];
          uniform vec3 u_colors[6];
          uniform float u_total_size;
          uniform float u_dot_size;
          uniform vec2 u_resolution;
          uniform int u_reverse;

          out vec4 fragColor;

          float PHI = 1.61803398874989484820459;
          float random(vec2 xy) {
              return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
          }

          void main() {
              vec2 st = fragCoord.xy;
              st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
              st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

              float opacity = step(0.0, st.x) * step(0.0, st.y);

              vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

              float frequency = 5.0;
              float show_offset = random(st2);
              float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
              opacity *= u_opacities[int(rand * 10.0)];
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
              opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

              vec3 color = u_colors[int(show_offset * 6.0)];

              float animation_speed_factor = 3.0;
              vec2 center_grid = u_resolution / 2.0 / u_total_size;
              float dist_from_center = distance(center_grid, st2);

              float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

              float current_timing_offset = timing_offset_intro;
              opacity *= step(current_timing_offset, u_time * animation_speed_factor);
              opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

              fragColor = vec4(color, opacity);
              fragColor.rgb *= fragColor.a;
          }
        `,
        uniforms,
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        transparent: true,
      });

      geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const startTime = performance.now();
      const animate = () => {
        if (!active) return;
        animationId = requestAnimationFrame(animate);
        uniforms.u_time.value = (performance.now() - startTime) / 1000.0;
        renderer?.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!renderer) return;
        renderer.setSize(window.innerWidth, window.innerHeight);
        uniforms.u_resolution.value.set(window.innerWidth * 2, window.innerHeight * 2);
      };
      window.addEventListener('resize', handleResize);
      removeResize = () => window.removeEventListener('resize', handleResize);
    };

    const loadThree = () => {
      if (window.THREE) {
        initThree(window.THREE);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.async = true;
      script.onload = () => {
        if (window.THREE) initThree(window.THREE);
      };
      document.head.appendChild(script);
    };

    loadThree();

    return () => {
      active = false;
      removeResize?.();
      if (animationId) cancelAnimationFrame(animationId);
      renderer?.dispose();
      geometry?.dispose();
      material?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      aria-hidden
    />
  );
}

export function ModernAuthLayout({ mode, children }: ModernAuthLayoutProps) {
  const isLogin = mode === 'login';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: BG,
        color: '#fff',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '1rem',
      }}
    >
      <DotCanvasBackground />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(circle at center,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: CARD,
          borderRadius: 12,
          padding: '2rem',
          width: '100%',
          maxWidth: 400,
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            className={dancingScript.className}
            style={{
              fontSize: '3rem',
              color: '#ffffff',
              marginBottom: '1rem',
              textShadow: '0 0 20px rgba(255, 255, 255, 0.15)',
              lineHeight: 1,
            }}
          >
            Ciphera
          </div>

          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
              letterSpacing: '-0.025em',
            }}
          >
            {isLogin ? 'Sign in to Account' : 'Sign up for Account'}
          </h1>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#888',
              marginBottom: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            {isLogin
              ? 'Sign in to your Ciphera account.'
              : 'Create a new Ciphera account to get started.'}
          </p>

          {children}



          <div style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: '#888' }}>
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <Link
                  href="/register"
                  style={{ color: '#fff', fontWeight: 500, textDecoration: 'none' }}
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link
                  href="/login"
                  style={{ color: '#fff', fontWeight: 500, textDecoration: 'none' }}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          <div
            style={{
              marginTop: '0.85rem',
              fontSize: '0.75rem',
              color: '#666',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            By proceeding, you agree to our{' '}
            <a href="#" style={{ color: '#888' }}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" style={{ color: '#888' }}>
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModernAuthLayout;
