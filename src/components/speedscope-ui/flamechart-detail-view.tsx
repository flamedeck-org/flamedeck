import {formatPercent} from '@/lib/speedscope-core/lib-utils'
import {Frame, CallTreeNode} from '@/lib/speedscope-core/profile'
import {ColorChit} from './color-chit'
import {Flamechart} from '@/lib/speedscope-core/flamechart'
import {useTheme} from './themes/theme'

interface StatisticsTableProps {
  title: string
  grandTotal: number
  selectedTotal: number
  selectedSelf: number
  // cellStyle: StyleDeclarationValue
  formatter: (v: number) => string
}

function StatisticsTable(props: StatisticsTableProps) {
  // const style = getFlamechartStyle(useTheme())

  const total = props.formatter(props.selectedTotal)
  const self = props.formatter(props.selectedSelf)
  const totalPerc = (100.0 * props.selectedTotal) / props.grandTotal
  const selfPerc = (100.0 * props.selectedSelf) / props.grandTotal

  // return (
  //   <div className={css(style.statsTable)}>
  //     <div className={css(props.cellStyle, style.statsTableCell, style.statsTableHeader)}>
  //       {props.title}
  //     </div>

  //     <div className={css(props.cellStyle, style.statsTableCell)}>Total</div>
  //     <div className={css(props.cellStyle, style.statsTableCell)}>Self</div>

  //     <div className={css(props.cellStyle, style.statsTableCell)}>{total}</div>
  //     <div className={css(props.cellStyle, style.statsTableCell)}>{self}</div>

  //     <div className={css(props.cellStyle, style.statsTableCell)}>
  //       {formatPercent(totalPerc)}
  //       <div className={css(style.barDisplay)} style={{height: `${totalPerc}%`}} />
  //     </div>
  //     <div className={css(props.cellStyle, style.statsTableCell)}>
  //       {formatPercent(selfPerc)}
  //       <div className={css(style.barDisplay)} style={{height: `${selfPerc}%`}} />
  //     </div>
  //   </div>
  // )

  return (
    <div>
      <div>
        {props.title}
      </div>

      <div>Total</div>
      <div>Self</div>

      <div>{total}</div>
      <div>{self}</div>

      <div>
        {formatPercent(totalPerc)}
        <div style={{height: `${totalPerc}%`}} />
      </div>
      <div>
        {formatPercent(selfPerc)}
        <div style={{height: `${selfPerc}%`}} />
      </div>
    </div>
  )
}

interface StackTraceViewProps {
  getFrameColor: (frame: Frame) => string
  node: CallTreeNode
}
function StackTraceView(props: StackTraceViewProps) {
  // const style = getFlamechartStyle(useTheme())

  const rows: JSX.Element[] = []
  let node: CallTreeNode | null = props.node
  for (; node && !node.isRoot(); node = node.parent) {
    const row: (JSX.Element | string)[] = []
    const {frame} = node

    row.push(<ColorChit color={props.getFrameColor(frame)} />)

    if (rows.length) {
      row.push(<span>&gt; </span>)
      // row.push(<span className={css(style.stackFileLine)}>&gt; </span>)
    }

    row.push(frame.name)

    if (frame.file) {
      let pos = frame.file
      if (frame.line != null) {
        pos += `:${frame.line}`
        if (frame.col != null) {
          pos += `:${frame.col}`
        }
      }
      // row.push(<span className={css(style.stackFileLine)}> ({pos})</span>)
      row.push(<span> ({pos})</span>)
    }
    rows.push(<div>{row}</div>)
  }

  // return (
  //   <div className={css(style.stackTraceView)}>
  //     <div className={css(style.stackTraceViewPadding)}>{rows}</div>
  //   </div>
  // )
  return (
    <div>
      <div>{rows}</div>
    </div>
  )
}

interface FlamechartDetailViewProps {
  flamechart: Flamechart
  getCSSColorForFrame: (frame: Frame) => string
  selectedNode: CallTreeNode
}

export function FlamechartDetailView(props: FlamechartDetailViewProps) {
  // const style = getFlamechartStyle(useTheme())

  const {flamechart, selectedNode} = props
  const {frame} = selectedNode

  return (
    <div>
      <StatisticsTable
        title={'This Instance'}
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={selectedNode.getTotalWeight()}
        selectedSelf={selectedNode.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      <StatisticsTable
        title={'All Instances'}
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={frame.getTotalWeight()}
        selectedSelf={frame.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      <StackTraceView node={selectedNode} getFrameColor={props.getCSSColorForFrame} />
    </div>
  )
}
