'use client';

import { SearchBar } from '@/app/component/SearchBar';
import { useCallback, useEffect, useState } from 'react';
import { SearchBarItem } from '@/app/component/type';
import { JsCourseService } from '@/wasm/pkg';
import { useRouter } from 'next/navigation';
import useRequest from '@/app/common/request';
import _ from 'lodash';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/26 01:09
 */

export const Search = () => {
	const [keyword, setKeyword] = useState('');
	const [searchBarItem, setSearchBarItem] = useState<SearchBarItem<string>[]>(
		[]
	);
	const { request } = useRequest();
	const router = useRouter();

	const doSearch = useCallback(() => {
		if (!keyword.replace(/ /g, '').length) {
			return;
		}
		request({
			call: () => JsCourseService.searchCourse(keyword),
		}).then((hitResult) => {
			const searchBarItemList: SearchBarItem<string>[] = hitResult.map(
				(item) => {
					return {
						text: item.hit,
						data: item.value,
					};
				}
			);
			setSearchBarItem(searchBarItemList);
		});
	}, [keyword, request]);

	useEffect(() => {
		const debounceFunc = _.debounce(() => {
			doSearch();
		}, 200);
		debounceFunc();
		return () => debounceFunc.cancel();
	}, [doSearch, keyword, request]);

	return (
		<div
			className={
				'w-full flex flex-col justify-center items-center px-4 sm:px-20'
			}
		>
			<span className={'material-icons-round text-purple-500 !text-[72px]'}>
				bar_chart
			</span>
			<SearchBar
				className={'max-w-[480px] mt-8'}
				keyword={keyword}
				hint={'输入课程名或讲师'}
				searchResult={searchBarItem}
				focusInputOnLoad={true}
				onKeywordChange={(value) => {
					setKeyword(value);
				}}
				onClickItem={(item) => {
					router.push(`/course-grade-stat/search?keyword=${item.data}`);
				}}
			/>
			<p className={'mt-4 text-black/40 h-4'}>
				{keyword.length !== 0 ? '' : '在搜索框输入，然后选中候补关键字'}
			</p>
		</div>
	);
};
