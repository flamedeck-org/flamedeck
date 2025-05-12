import { Component } from 'react';

import type { ProfileGroup } from '@flamedeck/speedscope-core/profile';
import { SandwichViewContainer } from './sandwich-view';
import type { ActiveProfileState } from '../../lib/speedscope-core/app-state/active-profile-state';
import { LeftHeavyFlamechartView, ChronoFlamechartView } from './flamechart-view-container';
import type { CanvasContext } from '@flamedeck/speedscope-gl/src/canvas-context';
import { Toolbar } from './toolbar';
import type { Theme } from '@flamedeck/speedscope-theme/types';
import { ViewMode } from '../../lib/speedscope-core/view-mode';
import type { ProfileGroupState } from '../../lib/speedscope-core/app-state/profile-group';
import type { HashParams } from '../../lib/speedscope-core/hash-params';
import { FlamechartID } from '../../lib/speedscope-core/app-state/profile-group';

const importModule = import('@flamedeck/speedscope-import');

// Force eager loading of a few code-split modules.
//
// We put them all in one place so we can directly control the relative priority
// of these.
importModule.then(() => {});
import('@flamedeck/speedscope-core/demangle-cpp').then(() => {});
import('source-map').then(() => {});

interface GLCanvasProps {
  canvasContext: CanvasContext | null;
  theme: Theme;
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void;
}
export class GLCanvas extends Component<GLCanvasProps> {
  private canvas: HTMLCanvasElement | null = null;

  private ref: React.RefCallback<HTMLCanvasElement> = (canvas) => {
    if (canvas instanceof HTMLCanvasElement) {
      this.canvas = canvas;
    } else {
      this.canvas = null;
    }

    this.props.setGLCanvas(this.canvas);
  };

  private container: HTMLElement | null = null;
  private containerRef: React.RefCallback<HTMLElement> = (container) => {
    if (container instanceof HTMLElement) {
      this.container = container;
    } else {
      this.container = null;
    }
  };

  private maybeResize = () => {
    if (!this.container) return;
    if (!this.props.canvasContext) return;

    const { width, height } = this.container.getBoundingClientRect();

    const widthInAppUnits = width;
    const heightInAppUnits = height;
    const widthInPixels = width * window.devicePixelRatio;
    const heightInPixels = height * window.devicePixelRatio;

    this.props.canvasContext.gl.resize(
      widthInPixels,
      heightInPixels,
      widthInAppUnits,
      heightInAppUnits
    );
  };

  onWindowResize = () => {
    if (this.props.canvasContext) {
      this.props.canvasContext.requestFrame();
    }
  };
  componentDidUpdate(prevProps: Readonly<GLCanvasProps>) {
    if (this.props.canvasContext !== prevProps.canvasContext) {
      if (prevProps.canvasContext) {
        prevProps.canvasContext.removeBeforeFrameHandler(this.maybeResize);
      }
      if (this.props.canvasContext) {
        this.props.canvasContext.addBeforeFrameHandler(this.maybeResize);
        this.props.canvasContext.requestFrame();
      }
    }
  }
  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
    this.maybeResize();
    if (this.props.canvasContext) {
      this.props.canvasContext.addBeforeFrameHandler(this.maybeResize);
      this.props.canvasContext.requestFrame();
    }
  }
  componentWillUnmount() {
    if (this.props.canvasContext) {
      this.props.canvasContext.removeBeforeFrameHandler(this.maybeResize);
    }
    window.removeEventListener('resize', this.onWindowResize);
  }
  render() {
    // TODO: Fix theme styling
    // const style = getStyle(this.props.theme)
    return (
      <div ref={this.containerRef} className="absolute inset-0 -z-1 pointer-events-none">
        <canvas ref={this.ref} width={1} height={1} />
      </div>
    );
  }
}

export type ApplicationProps = {
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: boolean) => void;
  setProfileGroup: (profileGroup: ProfileGroup) => void;
  setDragActive: (dragActive: boolean) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setFlattenRecursion: (flattenRecursion: boolean) => void;
  setProfileIndexToView: (profileIndex: number) => void;
  activeProfileState: ActiveProfileState | null;
  canvasContext: CanvasContext | null;
  theme: Theme;
  profileGroup: ProfileGroupState;
  flattenRecursion: boolean;
  viewMode: ViewMode;
  hashParams: HashParams;
  dragActive: boolean;
  loading: boolean;
  glCanvas: HTMLCanvasElement | null;
  error: boolean;
  setFlamechartViewState?: (id: FlamechartID, viewState: any) => void;
  setSelectedFrame?: (frame: FrameInfo | null) => void;
};

export class Application extends Component<ApplicationProps> {
  onWindowKeyPress = async (ev: KeyboardEvent) => {
    if (ev.key === '1') {
      this.props.setViewMode(ViewMode.CHRONO_FLAME_CHART);
    } else if (ev.key === '2') {
      this.props.setViewMode(ViewMode.LEFT_HEAVY_FLAME_GRAPH);
    } else if (ev.key === '3') {
      this.props.setViewMode(ViewMode.SANDWICH_VIEW);
    } else if (ev.key === 'r') {
      const { flattenRecursion } = this.props;
      this.props.setFlattenRecursion(!flattenRecursion);
    } else if (ev.key === 'n') {
      const { activeProfileState } = this.props;
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index + 1);
      }
    } else if (ev.key === 'p') {
      const { activeProfileState } = this.props;
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index - 1);
      }
    }
  };

  componentDidMount() {
    window.addEventListener('keypress', this.onWindowKeyPress);
  }

  componentWillUnmount() {
    window.removeEventListener('keypress', this.onWindowKeyPress);
  }

  renderContent() {
    const { activeProfileState } = this.props;
    if (!activeProfileState) return null;

    let view: React.ReactNode = null;
    switch (this.props.viewMode) {
      case ViewMode.CHRONO_FLAME_CHART:
        view = (
          <ChronoFlamechartView
            flamechart={activeProfileState.profile.getAppendOrderCalltreeRoot()}
            flamechartRenderer={activeProfileState.chronoRenderer}
            canvasContext={this.props.canvasContext}
            theme={this.props.theme}
            activeProfileState={activeProfileState}
            flamechartID={FlamechartID.CHRONO}
            flamechartViewState={activeProfileState.chronoViewState}
            updateFlamechartViewState={this.props.setFlamechartViewState!}
          />
        );
        break;

      case ViewMode.LEFT_HEAVY_FLAME_GRAPH:
        view = (
          <LeftHeavyFlamechartView
            flamechart={activeProfileState.profile.getGroupedCalltreeRoot()}
            flamechartRenderer={activeProfileState.leftHeavyRenderer}
            canvasContext={this.props.canvasContext}
            theme={this.props.theme}
            activeProfileState={activeProfileState}
            flamechartID={FlamechartID.LEFT_HEAVY}
            flamechartViewState={activeProfileState.leftHeavyViewState}
            updateFlamechartViewState={this.props.setFlamechartViewState!}
          />
        );
        break;

      case ViewMode.SANDWICH_VIEW:
        view = (
          <SandwichViewContainer
            profile={activeProfileState.profile}
            sandwichViewState={activeProfileState.sandwichViewState}
            theme={this.props.theme}
            canvasContext={this.props.canvasContext}
            activeProfileState={activeProfileState}
            setSelectedFrame={this.props.setSelectedFrame!}
            setFlamechartViewState={this.props.setFlamechartViewState!}
          />
        );
        break;
    }

    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <Toolbar theme={this.props.theme} {...this.props} />
        {view}
      </div>
    );
  }

  render() {
    let content: React.ReactNode = null;

    content = this.renderContent();

    return (
      <div className="w-full h-full overflow-hidden flex flex-col relative font-mono text-sm text-foreground">
        <GLCanvas
          setGLCanvas={this.props.setGLCanvas}
          canvasContext={this.props.canvasContext}
          theme={this.props.theme}
        />
        {content}
      </div>
    );
  }
}

// const getStyle = withTheme(theme =>
//   StyleSheet.create({
//     glCanvasView: {
//       position: 'absolute',
//       width: '100vw',
//       height: '100vh',
//       zIndex: -1,
//       pointerEvents: 'none',
//     },
//     error: {
//       display: 'flex',
//       flexDirection: 'column',
//       alignItems: 'center',
//       justifyContent: 'center',
//       height: '100%',
//     },
//     loading: {
//       height: 3,
//       marginBottom: -3,
//       background: theme.selectionPrimaryColor,
//       transformOrigin: '0% 50%',
//       animationName: [
//         {
//           from: {
//             transform: `scaleX(0)`,
//           },
//           to: {
//             transform: `scaleX(1)`,
//           },
//         },
//       ],
//       animationTimingFunction: 'cubic-bezier(0, 1, 0, 1)',
//       animationDuration: '30s',
//     },
//     root: {
//       width: '100vw',
//       height: '100vh',
//       overflow: 'hidden',
//       display: 'flex',
//       flexDirection: 'column',
//       position: 'relative',
//       fontFamily: FontFamily.MONOSPACE,
//       lineHeight: '20px',
//       color: theme.fgPrimaryColor,
//     },
//     dragTargetRoot: {
//       cursor: 'copy',
//     },
//     dragTarget: {
//       boxSizing: 'border-box',
//       position: 'absolute',
//       top: 0,
//       left: 0,
//       width: '100%',
//       height: '100%',
//       border: `5px dashed ${theme.selectionPrimaryColor}`,
//       pointerEvents: 'none',
//     },
//     contentContainer: {
//       position: 'relative',
//       display: 'flex',
//       overflow: 'hidden',
//       flexDirection: 'column',
//       flex: 1,
//     },
//     landingContainer: {
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//       flex: 1,
//     },
//     landingMessage: {
//       maxWidth: 600,
//     },
//     landingP: {
//       marginBottom: 16,
//     },
//     hide: {
//       display: 'none',
//     },
//     browseButtonContainer: {
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//     },
//     browseButton: {
//       marginBottom: 16,
//       height: 72,
//       flex: 1,
//       maxWidth: 256,
//       textAlign: 'center',
//       fontSize: FontSize.BIG_BUTTON,
//       lineHeight: '72px',
//       background: theme.selectionPrimaryColor,
//       color: theme.altFgPrimaryColor,
//       transition: `all ${Duration.HOVER_CHANGE} ease-in`,
//       ':hover': {
//         background: theme.selectionSecondaryColor,
//       },
//     },
//     link: {
//       color: theme.selectionPrimaryColor,
//       cursor: 'pointer',
//       textDecoration: 'none',
//       transition: `all ${Duration.HOVER_CHANGE} ease-in`,
//       ':hover': {
//         color: theme.selectionSecondaryColor,
//       },
//     },
//     content: {
//       position: 'relative',
//       display: 'flex',
//       overflow: 'hidden',
//       flexDirection: 'column',
//       flex: 1,
//     },
//     application: {
//       width: '100vw',
//       height: '100vh',
//       overflow: 'hidden',
//       display: 'flex',
//       flexDirection: 'column',
//       position: 'relative',
//     },
//   }),
// )
