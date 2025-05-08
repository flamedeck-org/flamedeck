import { formatPercent } from '@/lib/speedscope-core/lib-utils';
import type { Frame, CallTreeNode } from '@/lib/speedscope-core/profile';
import { ColorChit } from './color-chit';
import type { Flamechart } from '@/lib/speedscope-core/flamechart';

interface StatisticsTableProps {
  title: string;
  grandTotal: number;
  selectedTotal: number;
  selectedSelf: number;
  instanceStyle: string;
  formatter: (v: number) => string;
}

function StatisticsTable(props: StatisticsTableProps) {
  const total = props.formatter(props.selectedTotal);
  const self = props.formatter(props.selectedSelf);
  const totalPerc = props.grandTotal === 0 ? 0 : (100.0 * props.selectedTotal) / props.grandTotal;
  const selfPerc = props.grandTotal === 0 ? 0 : (100.0 * props.selectedSelf) / props.grandTotal;

  const cellBaseStyle = 'relative flex justify-center items-center';

  return (
    <div className="grid grid-cols-2 grid-rows-[24px_24px_24px] gap-px text-center pr-px">
      <div className={`${cellBaseStyle} ${props.instanceStyle} col-span-2`}>{props.title}</div>

      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>Total</div>
      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>Self</div>

      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>{total}</div>
      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>{self}</div>

      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>
        {formatPercent(totalPerc)}
        <div
          className="absolute top-0 left-0 bg-black/20 w-full"
          style={{ height: `${totalPerc}%` }}
        />
      </div>
      <div className={`${cellBaseStyle} ${props.instanceStyle}`}>
        {formatPercent(selfPerc)}
        <div
          className="absolute top-0 left-0 bg-black/20 w-full"
          style={{ height: `${selfPerc}%` }}
        />
      </div>
    </div>
  );
}

interface StackTraceViewProps {
  getFrameColor: (frame: Frame) => string;
  node: CallTreeNode;
}
function StackTraceView(props: StackTraceViewProps) {
  const rows: JSX.Element[] = [];
  let node: CallTreeNode | null = props.node;
  for (; node && !node.isRoot(); node = node.parent) {
    const row: (JSX.Element | string)[] = [];
    const { frame } = node;

    row.push(<ColorChit key={`${frame.key}-chit`} color={props.getFrameColor(frame)} />);

    if (rows.length) {
      row.push(
        <span key={`${frame.key}-sep`} className="text-gray-500 dark:text-gray-400">
          &nbsp;&gt;{' '}
        </span>
      );
    }
    row.push(
      <span key={`${frame.key}-name`} className="text-gray-900 dark:text-gray-100">
        {frame.name}
      </span>
    );

    if (frame.file) {
      let pos = frame.file;
      if (frame.line != null) {
        pos += `:${frame.line}`;
        if (frame.col != null) {
          pos += `:${frame.col}`;
        }
      }
      row.push(
        <span key={`${frame.key}-pos`} className="text-gray-500 dark:text-gray-400">
          {' '}
          ({pos})
        </span>
      );
    }
    rows.push(
      <div key={frame.key} className="whitespace-nowrap">
        {row}
      </div>
    );
  }
  return (
    <div className="h-40 leading-normal overflow-auto bg-background">
      <div className="p-[5px]">{rows}</div>
    </div>
  );
}

interface FlamechartDetailViewProps {
  flamechart: Flamechart;
  getCSSColorForFrame: (frame: Frame) => string;
  selectedNode: CallTreeNode;
}

export function FlamechartDetailView(props: FlamechartDetailViewProps) {
  const { flamechart, selectedNode } = props;
  const { frame } = selectedNode;

  return (
    <div className="grid h-40 overflow-hidden grid-cols-[120px_120px_1fr] grid-rows-1 border-t border-gray-300 dark:border-gray-700 text-xs absolute bg-background w-screen bottom-0 font-mono">
      <StatisticsTable
        title={'This Instance'}
        instanceStyle="bg-blue-500 text-white"
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={selectedNode.getTotalWeight()}
        selectedSelf={selectedNode.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      <StatisticsTable
        title={'All Instances'}
        instanceStyle="bg-purple-500 text-white"
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={frame.getTotalWeight()}
        selectedSelf={frame.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      <StackTraceView node={selectedNode} getFrameColor={props.getCSSColorForFrame} />
    </div>
  );
}
