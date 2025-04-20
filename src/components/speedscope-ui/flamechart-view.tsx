import React, { Fragment, Component } from 'react';

import {CallTreeNode, Frame} from '../../lib/speedscope-core/profile';
import {Rect, Vec2, AffineTransform} from '../../lib/speedscope-core/math';
import {formatPercent} from '../../lib/speedscope-core/lib-utils';
import {FlamechartMinimapView} from './flamechart-minimap-view'

import {Sizes, commonStyle} from './style'
import {FlamechartDetailView} from './flamechart-detail-view'
import {FlamechartPanZoomView} from './flamechart-pan-zoom-view'
import {Hovertip} from './hovertip'
import {FlamechartViewProps} from './flamechart-view-container'
import {ProfileSearchContext} from './search-view'
import {FlamechartSearchView} from './flamechart-search-view'
import { Theme } from './themes/theme'

export class FlamechartView extends Component<FlamechartViewProps> {
  private configSpaceSize() {
    return new Vec2(
      this.props.flamechart.getTotalWeight(),
      this.props.flamechart.getLayers().length,
    )
  }

  private setConfigSpaceViewportRect = (viewportRect: Rect): void => {
    const configSpaceDetailViewHeight = Sizes.DETAIL_VIEW_HEIGHT / Sizes.FRAME_HEIGHT

    const configSpaceSize = this.configSpaceSize()

    const width = this.props.flamechart.getClampedViewportWidth(viewportRect.size.x)
    const size = viewportRect.size.withX(width)

    const origin = Vec2.clamp(
      viewportRect.origin,
      new Vec2(0, -1),
      Vec2.max(
        Vec2.zero,
        configSpaceSize.minus(size).plus(new Vec2(0, configSpaceDetailViewHeight + 1)),
      ),
    )

    this.props.setConfigSpaceViewportRect(new Rect(origin, viewportRect.size.withX(width)))
  }

  private setLogicalSpaceViewportSize = (logicalSpaceViewportSize: Vec2): void => {
    this.props.setLogicalSpaceViewportSize(logicalSpaceViewportSize)
  }

  private transformViewport = (transform: AffineTransform): void => {
    this.setConfigSpaceViewportRect(transform.transformRect(this.props.configSpaceViewportRect))
  }

  private onNodeHover = (hover: {node: CallTreeNode; event: MouseEvent} | null) => {
    this.props.setNodeHover(hover)
  }

  onNodeClick = (node: CallTreeNode | null) => {
    this.props.setSelectedNode(node)
  }

  formatValue(weight: number) {
    const totalWeight = this.props.flamechart.getTotalWeight()
    const percent = (100 * weight) / totalWeight
    const formattedPercent = formatPercent(percent)
    return `${this.props.flamechart.formatValue(weight)} (${formattedPercent})`
  }

  renderTooltip() {
    if (!this.container) return null

    const {hover} = this.props
    if (!hover) return null
    const {width, height, left, top} = this.container.getBoundingClientRect()
    const offset = new Vec2(hover.event.clientX - left, hover.event.clientY - top)
    const frame = hover.node.frame

    return (
      <Hovertip containerSize={new Vec2(width, height)} offset={offset}>
        <span className="text-green-500">
          {this.formatValue(hover.node.getTotalWeight())}
        </span>{' '}
        {frame.name}
        {frame.file ? (
          <div>
            {frame.file}:{frame.line}
          </div>
        ) : undefined}
      </Hovertip>
    )
  }

  container: HTMLDivElement | null = null
  containerRef = (container: Element | null) => {
    this.container = (container as HTMLDivElement) || null
  }

  render() {
    return (
      <div className="fill-placeholder vbox-placeholder" ref={this.containerRef}>
        <FlamechartMinimapView
          theme={this.props.theme}
          configSpaceViewportRect={this.props.configSpaceViewportRect}
          transformViewport={this.transformViewport}
          flamechart={this.props.flamechart}
          flamechartRenderer={this.props.flamechartRenderer}
          canvasContext={this.props.canvasContext}
          setConfigSpaceViewportRect={this.setConfigSpaceViewportRect}
        />
        <ProfileSearchContext.Consumer>
          {searchResults => (
            <Fragment>
              <FlamechartPanZoomView
                theme={this.props.theme}
                canvasContext={this.props.canvasContext}
                flamechart={this.props.flamechart}
                flamechartRenderer={this.props.flamechartRenderer}
                renderInverted={false}
                onNodeHover={this.onNodeHover as any}
                onNodeSelect={this.onNodeClick}
                selectedNode={this.props.selectedNode}
                transformViewport={this.transformViewport}
                configSpaceViewportRect={this.props.configSpaceViewportRect}
                setConfigSpaceViewportRect={this.setConfigSpaceViewportRect}
                logicalSpaceViewportSize={this.props.logicalSpaceViewportSize}
                setLogicalSpaceViewportSize={this.setLogicalSpaceViewportSize}
                searchResults={searchResults}
              />
              <FlamechartSearchView />
            </Fragment>
          )}
        </ProfileSearchContext.Consumer>
        {this.renderTooltip()}
        {this.props.selectedNode && (
          <FlamechartDetailView
            flamechart={this.props.flamechart}
            getCSSColorForFrame={this.props.getCSSColorForFrame}
            selectedNode={this.props.selectedNode}
          />
        )}
      </div>
    )
  }
}
