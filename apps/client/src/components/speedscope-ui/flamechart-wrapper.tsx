import React from 'react'
import {CallTreeNode} from '../../lib/speedscope-core/profile'
import {Rect, AffineTransform, Vec2} from '../../lib/speedscope-core/math'
import {FlamechartPanZoomView} from './flamechart-pan-zoom-view'
import {noop, formatPercent} from '../../lib/speedscope-core/lib-utils'
import {Hovertip} from './hovertip'
import {FlamechartViewProps, FlamechartHover} from './flamechart-view-container'

export class FlamechartWrapper extends React.Component<FlamechartViewProps> {
  private containerRef = React.createRef<HTMLDivElement>()

  private clampViewportToFlamegraph = (viewportRect: Rect): Rect => {
    const {flamechart, renderInverted} = this.props
    return flamechart.getClampedConfigSpaceViewportRect({
      configSpaceViewportRect: viewportRect,
      renderInverted,
    })
  }

  private setConfigSpaceViewportRect = (configSpaceViewportRect: Rect): void => {
    this.props.setConfigSpaceViewportRect(this.clampViewportToFlamegraph(configSpaceViewportRect))
  }

  private setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    this.props.setLogicalSpaceViewportSize(logicalSpaceViewportSize)
  }

  private transformViewport = (transform: AffineTransform): void => {
    this.setConfigSpaceViewportRect(transform.transformRect(this.props.configSpaceViewportRect))
  }

  private formatValue = (weight: number): string => {
    const totalWeight = this.props.flamechart.getTotalWeight()
    const percent = (100 * weight) / totalWeight
    const formattedPercent = formatPercent(percent)
    return `${this.props.flamechart.formatValue(weight)} (${formattedPercent})`
  }

  private setNodeHover = (hover: FlamechartHover | null): void => {
    this.props.setNodeHover(hover)
  }

  private renderTooltip() {
    const container = this.containerRef.current
    if (!container) return null

    const {hover} = this.props
    if (!hover) return null

    const {width, height, left, top} = container.getBoundingClientRect()

    const event = hover.event as unknown as React.MouseEvent
    const offset = new Vec2(event.clientX - left, event.clientY - top)
    const frame = hover.node.frame

    return (
      <Hovertip containerSize={new Vec2(width, height)} offset={offset}>
        <span className="font-semibold">{this.formatValue(hover.node.getTotalWeight())}</span>{' '}
        {frame.name}
        {frame.file ? (
          <div>
            {frame.file}:{frame.line}
          </div>
        ) : undefined}
      </Hovertip>
    )
  }

  render() {
    
    return (
      <div
        className="h-full w-full flex flex-col relative"
        ref={this.containerRef}
      >
        <FlamechartPanZoomView
          theme={this.props.theme}
          selectedNode={null}
          onNodeHover={this.setNodeHover}
          onNodeSelect={noop}
          configSpaceViewportRect={this.props.configSpaceViewportRect}
          setConfigSpaceViewportRect={this.setConfigSpaceViewportRect}
          transformViewport={this.transformViewport}
          flamechart={this.props.flamechart}
          flamechartRenderer={this.props.flamechartRenderer}
          canvasContext={this.props.canvasContext}
          renderInverted={this.props.renderInverted}
          logicalSpaceViewportSize={this.props.logicalSpaceViewportSize}
          setLogicalSpaceViewportSize={this.setLogicalSpaceViewportSize}
          searchResults={null}
        />
        {this.renderTooltip()}
      </div>
    )
  }
}
