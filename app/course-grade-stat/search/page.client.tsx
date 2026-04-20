'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
	JsCourseGradeStatisticsItemOrder,
	JsCourseScoreItem,
	JsCourseScoreItemType,
	JsScoreService,
} from '@/wasm/pkg';
import useRequest from '@/hooks/useRequest';
import { Header } from '@/app/course-grade-stat/search/header';
import Body from '@/app/course-grade-stat/search/body';

const SearchResultClient = () => {
	const query = useSearchParams();
	const keyword = query.get('keyword') ?? '';
	const [result, setResult] = useState<JsCourseScoreItem[]>([]);
	const { request } = useRequest();
	useEffect(() => {
		request({
			call: () =>
				JsScoreService.getScoreStat(
					JsCourseScoreItemType.courseName(),
					keyword,
					JsCourseGradeStatisticsItemOrder.scoreDesc()
				),
		}).then((r) => setResult(r));
	}, [keyword, request]);

	return (
		<div className={'min-h-screen h-full bg-black/5'}>
			<div className={'h-[8px] bg-white'} />
			<Header queryKeyword={keyword} />
			<Body result={result} />
		</div>
	);
};

export default SearchResultClient;
