/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/26 15:43
 */
import { SearchBar } from '@/components/SearchBar';
import { useCallback, useEffect, useState } from 'react';
import { Separator, Link } from '@heroui/react';
import { JsCourseService, JsSearchScoreHitItem } from '@/wasm/pkg';
import { SearchBarItem } from '@/components/type';
import { useRouter } from 'next/navigation';
import { UserInfoAvatar } from '@/components/userinfo/UserInfoAvatar';
import _ from 'lodash';
import useRequest from '@/hooks/useRequest';

const Header = ({ queryKeyword }: { queryKeyword: string }) => {
	const [inputKeyword, setInputKeyword] = useState(queryKeyword);
	const [searchResult, setSearchResult] = useState<
		SearchBarItem<JsSearchScoreHitItem>[]
	>([]);
	const router = useRouter();
	const { request } = useRequest();

	const searchScore = useCallback(() => {
		if (!inputKeyword.length) {
			return;
		}
		request({
			call: () => JsCourseService.searchCourse(inputKeyword),
		}).then((r) => {
			const resultList: SearchBarItem<JsSearchScoreHitItem>[] = r.map(
				(item) => {
					return {
						text: item.hit,
						data: item,
					};
				}
			);
			setSearchResult(resultList);
		});
	}, [inputKeyword, request]);

	useEffect(() => {
		setInputKeyword(queryKeyword);
	}, [queryKeyword]);
	useEffect(() => {
		const searchScoreDebounce = _.debounce(() => {
			searchScore();
		}, 200);
		searchScoreDebounce();
		return () => searchScoreDebounce.cancel();
	}, [request, searchScore]);

	return (
		<div className={'bg-white sticky top-0 left-0'}>
			<div
				className={
					'py-4 flex items-center gap-4 ' +
					'px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 2xl:px-48'
				}
			>
				<Link href='/course-grade-stat'>
					<span className={'material-icons-round text-purple-500 !text-[36px]'}>
						bar_chart
					</span>
				</Link>

				<div className={'w-full'}>
					<SearchBar
						hint={'输入课程名或讲师'}
						keyword={inputKeyword}
						searchResult={searchResult}
						onKeywordChange={setInputKeyword}
						onClickItem={(item) => {
							router.push(
								`/course-grade-stat/search?keyword=${item.data.value}`
							);
						}}
						className={'max-w-[48rem]'}
					/>
				</div>
				<div className={'justify-self-end'}>
					<UserInfoAvatar />
				</div>
			</div>
			<Separator />
		</div>
	);
};

export { Header };
