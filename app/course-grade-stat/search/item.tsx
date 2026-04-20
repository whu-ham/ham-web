/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/26 20:33
 */
import { Separator } from '@heroui/react';
import { JsCourseScoreItem, JsCourseScoreRangeResponseItem } from '@/wasm/pkg';

const CourseGradeStatItem = ({ result }: { result: JsCourseScoreItem }) => {
	return (
		<div
			className={
				'bg-white rounded-[12px] p-4 grid grid-cols-[1fr_4px_64px] gap-2 items-center'
			}
		>
			<div>
				<div>
					<div className={'font-bold line-clamp-2'}>{result.name}</div>
					<div className={'text-sm mt-[-2px] line-clamp-2'}>
						{result.instructor}
					</div>
				</div>
				<div className={'mt-4 text-sm'}>{result.total}位同学的成绩</div>
				<div>
					{result.range.map((range, i) => {
						return <SingleRange range={range} total={result.total} key={i} />;
					})}
				</div>
			</div>
			<Separator
				orientation={'vertical'}
				className={'justify-self-center max-h-36'}
			/>
			<div>
				<div className={'text-xs'}>平均</div>
				<div className={'text-2xl font-bold'}>{result.average.toFixed(1)}</div>
			</div>
		</div>
	);
};

const SingleRange = ({
	range,
	total,
}: {
	range: JsCourseScoreRangeResponseItem;
	total: number;
}) => {
	const progress = range.total / (total ?? 1);
	return (
		<div className={'flex items-center'}>
			<div className={'text-sm w-16 shrink-0'}>
				{range.from}-{range.to}
			</div>
			<div
				className={`grid w-full items-center`}
				style={{
					gridTemplateColumns: `${progress}fr 32px`,
				}}
			>
				<div
					className={'h-[6px] rounded-[3px]' + (progress > 0 ? ' mr-1' : '')}
					style={{
						backgroundColor: range.color,
					}}
				/>
				<div
					className={'text-sm'}
					style={{
						color: range.color,
					}}
				>
					{range.total}
				</div>
			</div>
		</div>
	);
};

export default CourseGradeStatItem;
