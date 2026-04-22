import { useEffect, useRef, useState } from 'react';
import { Separator } from '@heroui/react';
import { SearchBarItem } from '@/components/type';
import classNames from 'classnames';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/26 15:47
 */
interface SearchItemText {
	type: 'NORMAL' | 'STRONG';
	text: string;
}

const parseSearchItemText = (text: string): SearchItemText[] => {
	const regex = /<strong>(.*?)<\/strong>/g;
	const result: SearchItemText[] = [];
	let lastIndex = 0;
	let match;
	while ((match = regex.exec(text))) {
		if (match.index > lastIndex) {
			result.push({
				type: 'NORMAL',
				text: text.slice(lastIndex, match.index),
			});
		}
		result.push({
			type: 'STRONG',
			text: match[1],
		});
		lastIndex = regex.lastIndex;
	}
	if (lastIndex < text.length) {
		result.push({
			type: 'NORMAL',
			text: text.slice(lastIndex),
		});
	}
	return result;
};

const SearchItem = ({
	text,
	onClick,
}: {
	text: string;
	onClick: () => void;
}) => {
	return (
		<div
			onClick={onClick}
			className={
				'hover:bg-black/10 inline-flex items-center w-full px-[12px] py-[8px]'
			}
		>
			<div className={'material-icons-round mr-[2px] text-gray-400'}>
				search
			</div>
			<div>
				{parseSearchItemText(text).map((itemText, i) => {
					return (
						<span
							key={i}
							className={
								itemText.type === 'STRONG' ? 'font-bold' : 'text-black/50'
							}
						>
							{itemText.text}
						</span>
					);
				})}
			</div>
		</div>
	);
};

const SearchBar = <T,>({
	keyword,
	onKeywordChange,
	focusInputOnLoad = false,
	hint = '',
	onClickItem,
	searchResult = [],
	clearable = true,
	className = '',
}: {
	keyword: string;
	onKeywordChange: (value: string) => void;
	focusInputOnLoad?: boolean;
	hint?: string;
	searchResult?: SearchBarItem<T>[];
	clearable?: boolean;
	onClickItem?: (SearchBarItem: SearchBarItem<T>) => void;
	className?: string;
}) => {
	const divRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [expanded, setExpanded] = useState(false);
	const handleBodyClick = (e: MouseEvent) => {
		const clickInside =
			divRef.current?.contains(e.target as HTMLElement) ?? false;
		setExpanded(clickInside);
	};

	useEffect(() => {
		document.addEventListener('click', handleBodyClick);
		return () => document.removeEventListener('click', handleBodyClick);
	}, []);
	useEffect(() => {
		if (focusInputOnLoad) {
			inputRef.current?.focus();
		}
	}, [focusInputOnLoad]);

	return (
		<div className={`relative w-full ${className}`} ref={divRef}>
			<div
				className={classNames(
					'px-[12px] pt-[16px] w-full pb-[16px] h-[56px]',
					expanded
						? 'bg-white shadow-[0_2px_8px_1px_rgba(64,60,67,.24)]'
						: 'bg-black/5 hover:bg-black/10',
					expanded ? 'rounded-t-[16px]' : 'rounded-[16px]'
				)}
			>
				<div className={'inline-flex w-full'}>
					<span className={'material-icons-round mr-[8px]'}>search</span>
					<input
						className={
							'bg-transparent border-transparent outline-none w-full pr-[4px]'
						}
						maxLength={2048}
						placeholder={hint}
						value={keyword}
						ref={inputRef}
						onChange={(e) => {
							onKeywordChange(e.target.value);
							if (e.target.value.length) {
								setExpanded(true);
							}
						}}
					/>
					{clearable && (
						<span
							className={
								'material-icons-round cursor-pointer' +
								(keyword.length ? '' : ' invisible')
							}
							onClick={() => {
								onKeywordChange('');
								inputRef.current?.focus();
								setExpanded(true);
							}}
						>
							clear
						</span>
					)}
				</div>
			</div>
			{expanded && (
				<div
					className={
						'w-full bg-white absolute overflow-hidden top-[52px] left-0 rounded-b-[16px] shadow-[0_4px_6px_rgba(32,33,36,.28)] z-10'
					}
				>
					<div className={'px-[16px] w-full'}>
						<Separator />
					</div>
					<div className={'overscroll-contain overflow-auto max-h-[80vh] '}>
						<div className={'mt-[4px]'}>
							{searchResult.length > 0 ? (
								<ResultItem
									searchResult={searchResult}
									onClick={(item) => {
										onClickItem?.(item);
										setExpanded(false);
									}}
								/>
							) : (
								<p className={'w-full text-center my-2 text-black/50'}>
									没有找到课程或导师
								</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const ResultItem = <T,>({
	searchResult,
	onClick,
}: {
	searchResult: SearchBarItem<T>[];
	onClick: (item: SearchBarItem<T>) => void;
}) => {
	return (
		<>
			{searchResult.map((item, i) => {
				return (
					<SearchItem key={i} text={item.text} onClick={() => onClick(item)} />
				);
			})}
		</>
	);
};

export { SearchBar };
